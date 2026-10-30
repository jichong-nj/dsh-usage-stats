// usage-stats — 浏览器端：侧边栏"用量统计"面板。
// 按天 / 按月 / 自定义时间段查询 token 用量，附 GitHub 风格贡献热力图。
window.__ModuleLoader__.load({
	id: "@jichong/dsh-usage-stats",
	factory(require) {
		const React = require("react");
		const { useState, useEffect, useMemo, useCallback } = React;
		const h = React.createElement;

		const API = "/usage-stats/api";
		const CSS_ID = "@jichong/dsh-usage-stats/us.css";
		const WEEKS = 26;

		const inject = ["slots"];

		const CSS = `
.us { display:flex; flex-direction:column; height:100%; min-height:0;
  --us-bg:#ffffff; --us-fg:#1f2328; --us-bg2:#f6f8fa; --us-sf:#ffffff;
  --us-bd:#d0d7de; --us-mut:#59636e; --us-dim:#818b96;
  --us-blue:#0969da; --us-green:#1a7f37; --us-red:#cf222e;
  --us-h0:#ebedf0; --us-h1:#9be9a8; --us-h2:#40c463; --us-h3:#30a14e; --us-h4:#216e39;
  --us-cellbd:rgba(27,31,36,.08);
  background:var(--us-bg); color:var(--us-fg);
  font-family:var(--font-ui,system-ui,sans-serif); font-size:13px; }
@media (prefers-color-scheme: dark) {
  .us { --us-bg:#0d1117; --us-fg:#e6edf3; --us-bg2:#161b22; --us-sf:#161b22;
    --us-bd:#30363d; --us-mut:#9198a1; --us-dim:#6e7681;
    --us-blue:#4493f8; --us-green:#3fb950; --us-red:#f85149;
    --us-h0:#161b22; --us-h1:#0e4429; --us-h2:#006d32; --us-h3:#26a641; --us-h4:#39d353;
    --us-cellbd:rgba(240,246,252,.1); } }
.us * { box-sizing:border-box; }
.us-bar { display:flex; align-items:center; gap:8px; padding:8px 14px;
  border-bottom:1px solid var(--us-bd); background:var(--us-bg2); flex:0 0 auto; flex-wrap:wrap; }
.us-title { font-size:14px; font-weight:700; margin-right:8px; white-space:nowrap; }
.us-tab { border:1px solid var(--us-bd); background:var(--us-sf); color:var(--us-fg);
  border-radius:6px; padding:4px 12px; font-size:12.5px; cursor:pointer; }
.us-tab.on { border-color:var(--us-blue); color:var(--us-blue); font-weight:600; }
.us-input, .us-select { background:var(--us-sf); color:var(--us-fg); border:1px solid var(--us-bd);
  border-radius:6px; padding:4px 8px; font-size:12.5px; }
.us-input:focus, .us-select:focus { outline:none; border-color:var(--us-blue); }
.us-btn { background:var(--us-sf); color:var(--us-fg); border:1px solid var(--us-bd);
  border-radius:6px; padding:3px 10px; font-size:12px; cursor:pointer; }
.us-btn:hover { border-color:var(--us-blue); color:var(--us-blue); }
.us-btn:disabled { opacity:.5; cursor:default; }
.us-badge { font-size:11px; padding:1px 8px; border-radius:10px; background:var(--us-bg2);
  color:var(--us-mut); border:1px solid var(--us-bd); }
.us-err { margin:10px 14px 0; padding:6px 10px; border:1px solid var(--us-red);
  color:var(--us-red); border-radius:6px; background:rgba(207,34,46,.08); font-size:12px; }
.us-main { flex:1 1 auto; min-height:0; overflow-y:auto; padding:14px; }
.us-sec { font-size:12px; font-weight:700; color:var(--us-mut); margin:18px 0 8px;
  text-transform:uppercase; letter-spacing:.04em; }
.us-sec:first-child { margin-top:0; }
.us-cards { display:flex; gap:10px; flex-wrap:wrap; }
.us-card { border:1px solid var(--us-bd); border-radius:8px; background:var(--us-sf);
  padding:10px 14px; min-width:120px; }
.us-card .k { font-size:11px; color:var(--us-mut); margin-bottom:4px; }
.us-card .v { font-size:18px; font-weight:700; font-variant-numeric:tabular-nums; }
.us-card .v.green { color:var(--us-green); }
.us-table { border-collapse:collapse; font-size:12.5px; width:100%; }
.us-table th, .us-table td { border:1px solid var(--us-bd); padding:5px 10px; text-align:right;
  font-variant-numeric:tabular-nums; white-space:nowrap; }
.us-table th { background:var(--us-bg2); color:var(--us-mut); font-weight:600; }
.us-table th:first-child, .us-table td:first-child { text-align:left; }
.us-table td.model { max-width:340px; overflow:hidden; text-overflow:ellipsis; }
.us-table tr.total td { font-weight:700; background:var(--us-bg2); }
.us-heatwrap { overflow-x:auto; padding-bottom:4px; }
.us-heat { display:inline-flex; flex-direction:column; gap:4px; }
.us-heat-row { display:flex; gap:6px; }
.us-heat-months { display:grid; grid-auto-flow:column; grid-auto-columns:11px; column-gap:3px;
  font-size:10px; color:var(--us-mut); height:14px; }
.us-heat-month { white-space:nowrap; overflow:visible; }
.us-heat-days { display:grid; grid-template-rows:repeat(7,11px); row-gap:3px;
  font-size:10px; color:var(--us-mut); width:26px; }
.us-heat-days div { height:11px; line-height:11px; }
.us-heat-grid { display:grid; grid-template-rows:repeat(7,11px); grid-auto-flow:column;
  grid-auto-columns:11px; gap:3px; }
.us-cell { width:11px; height:11px; border-radius:2px; background:var(--us-h0);
  border:1px solid var(--us-cellbd); cursor:pointer; padding:0; }
.us-cell.l1 { background:var(--us-h1); } .us-cell.l2 { background:var(--us-h2); }
.us-cell.l3 { background:var(--us-h3); } .us-cell.l4 { background:var(--us-h4); }
.us-cell.blank { visibility:hidden; cursor:default; }
.us-cell.sel { outline:2px solid var(--us-blue); outline-offset:1px; }
.us-legend { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--us-mut); margin-top:6px; }
.us-legend .us-cell { cursor:default; }
.us-note { font-size:11.5px; color:var(--us-dim); margin-top:6px; }
.us-empty { color:var(--us-mut); padding:20px 0; }
`;

		function ensureCss() {
			if (document.getElementById(CSS_ID) !== null) return;
			const tag = document.createElement("style");
			tag.id = CSS_ID;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		function fmt(n) {
			if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
			if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
			if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
			return String(Math.round(n));
		}

		function hitRate(inp, cacheR) {
			const d = inp + cacheR;
			return d > 0 ? `${((cacheR / d) * 100).toFixed(1)}%` : "—";
		}

		function pad(n) {
			return String(n).padStart(2, "0");
		}

		function dateKey(d) {
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
		}

		function todayKey() {
			return dateKey(new Date());
		}

		function monthKey() {
			const d = new Date();
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
		}

		function daysAgoKey(n) {
			const d = new Date();
			d.setDate(d.getDate() - n);
			return dateKey(d);
		}

		const EMPTY = { calls: 0, inp: 0, out: 0, cacheR: 0, cacheW: 0, total: 0 };

		function sumDays(days) {
			const byModel = new Map();
			const total = { ...EMPTY };
			for (const d of days) {
				for (const [m, r] of Object.entries(d.models)) {
					let t = byModel.get(m);
					if (t === undefined) {
						t = { ...EMPTY };
						byModel.set(m, t);
					}
					t.calls += r.calls; t.inp += r.inp; t.out += r.out;
					t.cacheR += r.cacheR; t.cacheW += r.cacheW; t.total += r.total;
					total.calls += r.calls; total.inp += r.inp; total.out += r.out;
					total.cacheR += r.cacheR; total.cacheW += r.cacheW; total.total += r.total;
				}
			}
			return { byModel, total };
		}

		function PanelIcon({ size = 18 }) {
			return h(
				"svg",
				{
					width: size,
					height: size,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.8,
					strokeLinecap: "round",
					"aria-hidden": "true",
				},
				h("rect", { x: 3, y: 3, width: 7.5, height: 7.5, rx: 1.5 }),
				h("rect", { x: 13.5, y: 3, width: 7.5, height: 7.5, rx: 1.5 }),
				h("rect", { x: 3, y: 13.5, width: 7.5, height: 7.5, rx: 1.5 }),
				h("path", { d: "M17.25 13.5v7.5M13.5 17.25h7.5" }),
			);
		}

		function View() {
			const [data, setData] = useState(null);
			const [loading, setLoading] = useState(true);
			const [error, setError] = useState(null);
			const [mode, setMode] = useState("month");
			const [day, setDay] = useState(todayKey());
			const [month, setMonth] = useState(monthKey());
			const [from, setFrom] = useState(daysAgoKey(29));
			const [to, setTo] = useState(todayKey());
			const [modelFilter, setModelFilter] = useState("all");

			const load = useCallback(async () => {
				setLoading(true);
				setError(null);
				try {
					const r = await fetch(`${API}/stats`);
					const j = await r.json();
					if (j.ok !== true) throw new Error(j?.error?.message ?? `HTTP ${r.status}`);
					setData(j.data);
				} catch (e) {
					setError(String(e?.message ?? e));
				} finally {
					setLoading(false);
				}
			}, []);

			useEffect(() => {
				load();
			}, [load]);

			const models = useMemo(() => {
				const set = new Set();
				for (const d of data?.days ?? []) for (const m of Object.keys(d.models)) set.add(m);
				return [...set].sort();
			}, [data]);

			// 模型过滤后的日数据
			const filteredDays = useMemo(() => {
				const out = [];
				for (const d of data?.days ?? []) {
					let models2 = d.models;
					if (modelFilter !== "all") {
						if (!(modelFilter in d.models)) continue;
						models2 = { [modelFilter]: d.models[modelFilter] };
					}
					out.push({ date: d.date, models: models2 });
				}
				return out;
			}, [data, modelFilter]);

			// 时间范围过滤
			const rangeDays = useMemo(() => {
				const ok = (date) =>
					mode === "day" ? date === day : mode === "month" ? date.startsWith(`${month}-`) : date >= from && date <= to;
				return filteredDays.filter((d) => ok(d.date));
			}, [filteredDays, mode, day, month, from, to]);

			const { byModel, total } = useMemo(() => sumDays(rangeDays), [rangeDays]);
			const rows = useMemo(() => [...byModel.entries()].sort((a, b) => b[1].total - a[1].total), [byModel]);

			// 热力图：最近 WEEKS 周（按周对齐），值=当日 total（受模型过滤影响）
			const heat = useMemo(() => {
				const perDay = new Map();
				const callsPerDay = new Map();
				for (const d of filteredDays) {
					let t = 0;
					let c = 0;
					for (const r of Object.values(d.models)) {
						t += r.total;
						c += r.calls;
					}
					perDay.set(d.date, t);
					callsPerDay.set(d.date, c);
				}
				const max = Math.max(0, ...perDay.values());
				const level = (v) => (v <= 0 ? 0 : v <= max * 0.25 ? 1 : v <= max * 0.5 ? 2 : v <= max * 0.75 ? 3 : 4);
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const start = new Date(today);
				start.setDate(start.getDate() - (WEEKS - 1) * 7);
				start.setDate(start.getDate() - start.getDay());
				const weeks = [];
				const months = [];
				let lastMonth = -1;
				const cursor = new Date(start);
				while (cursor <= today || weeks.length % 1 !== 0) {
					const col = [];
					const first = new Date(cursor);
					for (let dow = 0; dow < 7; dow++) {
						const d = new Date(cursor);
						d.setDate(d.getDate() + dow);
						if (d > today) {
							col.push(null);
							continue;
						}
						const key = dateKey(d);
						col.push({ key, value: perDay.get(key) ?? 0, calls: callsPerDay.get(key) ?? 0, level: level(perDay.get(key) ?? 0) });
					}
					weeks.push(col);
					const m = first.getMonth();
					if (m !== lastMonth) {
						months.push({ col: weeks.length - 1, label: `${m + 1}月` });
						lastMonth = m;
					}
					cursor.setDate(cursor.getDate() + 7);
					if (weeks.length > WEEKS + 1) break;
				}
				return { weeks, months };
			}, [filteredDays]);

			const selDay = mode === "day" ? day : null;

			const pickDay = (key) => {
				setMode("day");
				setDay(key);
			};

			const rangeLabel =
				mode === "day" ? day : mode === "month" ? `${month} 月` : `${from} ~ ${to}`;

			return h(
				"div",
				{ className: "us" },
				h(
					"div",
					{ className: "us-bar" },
					h("span", { className: "us-title" }, "用量统计"),
					h(
						"button",
						{ className: `us-tab${mode === "day" ? " on" : ""}`, onClick: () => setMode("day") },
						"按天",
					),
					h(
						"button",
						{ className: `us-tab${mode === "month" ? " on" : ""}`, onClick: () => setMode("month") },
						"按月",
					),
					h(
						"button",
						{ className: `us-tab${mode === "range" ? " on" : ""}`, onClick: () => setMode("range") },
						"自定义",
					),
					mode === "day" &&
						h("input", { className: "us-input", type: "date", value: day, onChange: (e) => setDay(e.target.value) }),
					mode === "month" &&
						h("input", { className: "us-input", type: "month", value: month, onChange: (e) => setMonth(e.target.value) }),
					mode === "range" &&
						h(
							"span",
							{ style: { display: "inline-flex", gap: 6, alignItems: "center" } },
							h("input", { className: "us-input", type: "date", value: from, max: to, onChange: (e) => setFrom(e.target.value) }),
							h("span", { style: { color: "var(--us-mut)" } }, "→"),
							h("input", { className: "us-input", type: "date", value: to, min: from, onChange: (e) => setTo(e.target.value) }),
						),
					h(
						"select",
						{ className: "us-select", value: modelFilter, onChange: (e) => setModelFilter(e.target.value) },
						h("option", { value: "all" }, "全部模型"),
						models.map((m) => h("option", { key: m, value: m }, m)),
					),
					h("span", { style: { flex: "1 1 auto" } }),
					data !== null && h("span", { className: "us-badge" }, `${data.files} 个会话`),
					h("button", { className: "us-btn", disabled: loading, onClick: load }, loading ? "统计中…" : "刷新"),
				),
				error !== null && h("div", { className: "us-err" }, `统计失败：${error}`),
				h(
					"div",
					{ className: "us-main" },
					loading && data === null && h("div", { className: "us-empty" }, "正在扫描全部会话日志…"),
					data !== null &&
						h(
							React.Fragment,
							null,
							h("div", { className: "us-sec" }, `最近 ${WEEKS} 周用量 · 方块颜色 = 当日总 token`),
							h(
								"div",
								{ className: "us-heatwrap" },
								h(
									"div",
									{ className: "us-heat" },
									h(
										"div",
										{ className: "us-heat-row" },
										h("div", { className: "us-heat-days" }),
										h(
											"div",
											{ className: "us-heat-months" },
											heat.months.map((m) =>
												h(
													"div",
													{ key: m.col, className: "us-heat-month", style: { gridColumnStart: m.col + 1 } },
													m.label,
												),
											),
										),
									),
									h(
										"div",
										{ className: "us-heat-row" },
										h(
											"div",
											{ className: "us-heat-days" },
											h("div", null, ""),
											h("div", null, "一"),
											h("div", null, ""),
											h("div", null, "三"),
											h("div", null, ""),
											h("div", null, "五"),
											h("div", null, ""),
										),
										h(
											"div",
											{ className: "us-heat-grid" },
											heat.weeks.flatMap((col, ci) =>
												col.map((cell, i) =>
													cell === null
														? h("div", { key: `b${ci}-${i}`, className: "us-cell blank" })
														: h("button", {
																key: cell.key,
																className: `us-cell l${cell.level}${cell.key === selDay ? " sel" : ""}`,
																title: `${cell.key} · ${fmt(cell.value)} tokens · ${cell.calls} 次调用（点击按天查看）`,
																onClick: () => pickDay(cell.key),
															}),
												),
											),
										),
									),
								),
								h(
									"div",
									{ className: "us-legend" },
									h("span", null, "少"),
									[0, 1, 2, 3, 4].map((l) => h("span", { key: l, className: `us-cell l${l}` })),
									h("span", null, "多"),
									h(
										"span",
										{ style: { marginLeft: 12 } },
										`单日峰值 ${fmt(Math.max(0, ...heat.weeks.flat().filter(Boolean).map((c) => c.value)))}`,
									),
								),
							),
							h("div", { className: "us-sec" }, `当前范围：${rangeLabel}${modelFilter !== "all" ? ` · ${modelFilter}` : ""}`),
							rows.length === 0
								? h("div", { className: "us-empty" }, "该时间段内没有用量数据。")
								: h(
										React.Fragment,
										null,
										h(
											"div",
											{ className: "us-cards" },
											h("div", { className: "us-card" }, h("div", { className: "k" }, "总 token"), h("div", { className: "v" }, fmt(total.total))),
											h("div", { className: "us-card" }, h("div", { className: "k" }, "未缓存输入"), h("div", { className: "v" }, fmt(total.inp))),
											h("div", { className: "us-card" }, h("div", { className: "k" }, "输出"), h("div", { className: "v" }, fmt(total.out))),
											h("div", { className: "us-card" }, h("div", { className: "k" }, "缓存读取"), h("div", { className: "v" }, fmt(total.cacheR))),
											h("div", { className: "us-card" }, h("div", { className: "k" }, "缓存命中率"), h("div", { className: "v green" }, hitRate(total.inp, total.cacheR))),
											h("div", { className: "us-card" }, h("div", { className: "k" }, "调用次数"), h("div", { className: "v" }, String(total.calls))),
										),
										h("div", { className: "us-sec" }, "按模型"),
										h(
											"table",
											{ className: "us-table" },
											h(
												"thead",
												null,
												h(
													"tr",
													null,
													h("th", null, "模型"),
													h("th", null, "调用"),
													h("th", null, "未缓存输入"),
													h("th", null, "输出"),
													h("th", null, "缓存读取"),
													h("th", null, "命中率"),
													h("th", null, "总 token"),
												),
											),
											h(
												"tbody",
												null,
												rows.map(([m, r]) =>
													h(
														"tr",
														{ key: m },
														h("td", { className: "model", title: m }, m),
														h("td", null, String(r.calls)),
														h("td", null, fmt(r.inp)),
														h("td", null, fmt(r.out)),
														h("td", null, fmt(r.cacheR)),
														h("td", null, hitRate(r.inp, r.cacheR)),
														h("td", null, fmt(r.total)),
													),
												),
												h(
													"tr",
													{ className: "total" },
													h("td", null, "合计"),
													h("td", null, String(total.calls)),
													h("td", null, fmt(total.inp)),
													h("td", null, fmt(total.out)),
													h("td", null, fmt(total.cacheR)),
													h("td", null, hitRate(total.inp, total.cacheR)),
													h("td", null, fmt(total.total)),
												),
											),
										),
										h("div", { className: "us-note" }, "数据来源：本机全部会话日志中模型上报的 usage；命中率 = 缓存读取 ÷（缓存读取 + 未缓存输入）。"),
									),
						),
				),
			);
		}

		function apply(ctx) {
			ensureCss();
			// 左侧菜单面板：图标行（与"PPT知识库"同区，位于"新会话"下方、工作区上方）
			ctx.slots.inject("sidebar.panellist", () =>
				ctx.slots.register(
					{
						name: "sidebar.panellist",
						id: "usage-stats",
						order: 30,
						label: "用量统计",
					},
					PanelIcon,
				),
			);
			// 面板内容：选中该面板时渲染到 main 区域
			ctx.slots.inject("main", () =>
				ctx.slots.register(
					{
						name: "main",
						key: "usage-stats",
					},
					View,
				),
			);
		}

		return { name: "usage-stats", inject, apply };
	},
});
