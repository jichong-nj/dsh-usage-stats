// usage-stats — Host 端：扫描全部会话日志，按 天 × 模型 聚合 token 用量。
// 数据源：~/.dsh/sessions/<工作区>/<会话>/session.v4.jsonl.zstd
//   - request/header   → data.header.config.provider/model（取最近一次，作为后续 assistant/message 的模型）
//   - assistant/message → data.usage {inputTokens,outputTokens,totalTokens,cacheReadTokens,cacheWriteTokens}，事件 time 为 epoch ms
// 对外：GET /usage-stats/api/stats → { ok, data: { generatedAt, files, days: [{date, models: {model: rec}}] } }
// 缓存：按文件 (size, mtimeMs) 记忆解析结果，未变化的文件不重复解压。
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";

const name = "usage-stats";
const inject = ["webServer"];

function sessionsRoot() {
	return path.join(process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh"), "sessions");
}

function newRec() {
	return { calls: 0, inp: 0, out: 0, cacheR: 0, cacheW: 0, total: 0 };
}

function addRec(a, b) {
	a.calls += b.calls;
	a.inp += b.inp;
	a.out += b.out;
	a.cacheR += b.cacheR;
	a.cacheW += b.cacheW;
	a.total += b.total;
}

// epoch ms → 本地日期 "YYYY-MM-DD"
function dayKey(ms) {
	const d = new Date(ms);
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${m}-${dd}`;
}

function listSessionFiles() {
	const root = sessionsRoot();
	const out = [];
	let wsDirs;
	try {
		wsDirs = fs.readdirSync(root, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const ws of wsDirs) {
		if (!ws.isDirectory()) continue;
		const wsPath = path.join(root, ws.name);
		let sessDirs;
		try {
			sessDirs = fs.readdirSync(wsPath, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const s of sessDirs) {
			if (!s.isDirectory()) continue;
			const f = path.join(wsPath, s.name, "session.v4.jsonl.zstd");
			try {
				if (fs.statSync(f).isFile()) out.push(f);
			} catch {
				/* 不存在则跳过 */
			}
		}
	}
	return out;
}

// session.v4.jsonl.zstd 是多帧 zstd 流（每帧若干行），而 Node 的 zstdDecompressSync 只解第一帧，
// 因此按帧 magic（28 B5 2F FD）定位、逐帧解压后拼接。帧内偶发 magic 误判会解压失败，跳过即可，
// 不影响真实帧（真实帧总能从自身起点解出，解压结果尾部的多余数据会被忽略）。
function decompressAll(buf) {
	const out = [];
	for (let i = 0; i + 4 <= buf.length; i++) {
		if (buf[i] !== 0x28 || buf[i + 1] !== 0xb5 || buf[i + 2] !== 0x2f || buf[i + 3] !== 0xfd) continue;
		try {
			out.push(zlib.zstdDecompressSync(buf.subarray(i)));
		} catch {
			/* magic 误判或残帧：跳过 */
		}
	}
	return Buffer.concat(out).toString("utf8");
}

// 解析单个日志文件 → Map<date, Map<model, rec>>
function parseFile(file) {
	const text = decompressAll(fs.readFileSync(file));
	const days = new Map();
	let model = "unknown";
	let start = 0;
	for (let i = 0; i <= text.length; i++) {
		if (i !== text.length && text.charCodeAt(i) !== 10) continue;
		const line = text.slice(start, i);
		start = i + 1;
		if (line.length === 0) continue;
		let ev;
		try {
			ev = JSON.parse(line);
		} catch {
			continue;
		}
		const d = ev.data;
		if (d === undefined || d === null) continue;
		if (ev.type === "request/header") {
			const c = d.header && d.header.config;
			if (c && c.model) model = `${c.provider || "?"}/${c.model}`;
		} else if (ev.type === "assistant/message") {
			const u = d.usage;
			if (u === undefined || u === null) continue;
			if (typeof ev.time !== "number" || ev.time <= 0) continue;
			const date = dayKey(ev.time);
			let day = days.get(date);
			if (day === undefined) {
				day = new Map();
				days.set(date, day);
			}
			let rec = day.get(model);
			if (rec === undefined) {
				rec = newRec();
				day.set(model, rec);
			}
			rec.calls += 1;
			rec.inp += u.inputTokens ?? 0;
			rec.out += u.outputTokens ?? 0;
			rec.cacheR += u.cacheReadTokens ?? 0;
			rec.cacheW += u.cacheWriteTokens ?? 0;
			rec.total += u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0) + (u.cacheReadTokens ?? 0) + (u.cacheWriteTokens ?? 0);
		}
	}
	return days;
}

// path → { size, mtimeMs, days }
const fileCache = new Map();
let lastCollectMs = 0;
let lastCollectJson = null;
const COLLECT_TTL_MS = 5000;

function collect(ctx) {
	const files = listSessionFiles();
	const seen = new Set(files);
	for (const p of fileCache.keys()) if (!seen.has(p)) fileCache.delete(p);
	for (const f of files) {
		let st;
		try {
			st = fs.statSync(f);
		} catch {
			continue;
		}
		const hit = fileCache.get(f);
		if (hit !== undefined && hit.size === st.size && hit.mtimeMs === st.mtimeMs) continue;
		try {
			fileCache.set(f, { size: st.size, mtimeMs: st.mtimeMs, days: parseFile(f) });
		} catch (error) {
			ctx?.logger?.warn?.(`[usage-stats] parse failed ${f}: ${error?.message ?? error}`);
			fileCache.delete(f);
		}
	}
	const merged = new Map(); // date → model → rec
	for (const entry of fileCache.values()) {
		for (const [date, models] of entry.days) {
			let day = merged.get(date);
			if (day === undefined) {
				day = new Map();
				merged.set(date, day);
			}
			for (const [model, rec] of models) {
				let m = day.get(model);
				if (m === undefined) {
					m = newRec();
					day.set(model, m);
				}
				addRec(m, rec);
			}
		}
	}
	const days = [...merged.entries()]
		.sort((a, b) => (a[0] < b[0] ? -1 : 1))
		.map(([date, models]) => ({ date, models: Object.fromEntries(models) }));
	return { generatedAt: Date.now(), files: fileCache.size, days };
}

function writeJson(res, code, value) {
	const body = JSON.stringify(value);
	res.writeHead(code, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" });
	res.end(body);
}

function registerRoutes(ctx) {
	const handler = async (req, res) => {
		const url = new URL(req.url ?? "/", "http://localhost");
		if ((req.method !== "GET" && req.method !== "HEAD") || url.pathname !== "/usage-stats/api/stats") {
			return writeJson(res, 404, { ok: false, error: { code: "not-found", message: "unknown route" } });
		}
		try {
			// 5 秒内的重复请求直接复用上次结果，避免连点刷新反复解压
			if (lastCollectJson !== null && Date.now() - lastCollectMs < COLLECT_TTL_MS) {
				res.writeHead(200, lastCollectJson.headers);
				return res.end(lastCollectJson.body);
			}
			const data = collect(ctx);
			const body = JSON.stringify({ ok: true, data });
			lastCollectMs = Date.now();
			lastCollectJson = {
				headers: { "content-type": "application/json; charset=utf-8", "content-length": String(Buffer.byteLength(body)), "cache-control": "no-store" },
				body,
			};
			res.writeHead(200, lastCollectJson.headers);
			return res.end(body);
		} catch (error) {
			ctx?.logger?.warn?.(`[usage-stats] stats failed: ${error?.stack ?? error}`);
			return writeJson(res, 500, { ok: false, error: { code: "internal", message: String(error?.message ?? error) } });
		}
	};
	return ctx.webServer.register({ kind: "prefix", path: "/usage-stats/api", handler });
}

function apply(ctx) {
	ctx.effect(() => {
		const off = registerRoutes(ctx);
		return () => off?.();
	}, "usage-stats: api");
}

export { apply, inject, name };
