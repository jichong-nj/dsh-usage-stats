# usage-stats — 用量统计

在左侧边栏（"新会话"与工作区之间，与 PPT 知识库同区）添加 **用量统计** 面板：

- **按天 / 按月 / 自定义时间段** 查询 token 用量；
- **GitHub 风格贡献热力图**：最近 26 周，方块颜色 = 当日总 token，点击方块跳转到该日明细；
- 按模型分列的用量表（调用次数、未缓存输入、输出、缓存读取、命中率、总 token）；
- 模型下拉过滤，热力图与表格联动。

## 数据来源

扫描本机 `~/.dsh/sessions/<工作区>/<会话>/session.v4.jsonl.zstd` 全部会话日志：

- `request/header` 事件的 `data.header.config.provider/model` 决定后续调用的模型归属；
- `assistant/message` 事件的 `data.usage`（provider 上报的真实用量）按事件 `time`（epoch ms，本地时区）落到自然日；
- 命中率 = cacheRead ÷ (cacheRead + input)。

日志为多帧 zstd 流，Node 的 `zstdDecompressSync` 只解首帧，host 端按帧 magic 逐帧解压拼接。
解析结果按文件 `(size, mtimeMs)` 缓存，另有 5 秒结果级 TTL，刷新不会反复全量解压。

## API

`GET /usage-stats/api/stats` → `{ ok, data: { generatedAt, files, days: [{ date, models: { "<provider>/<model>": { calls, inp, out, cacheR, cacheW, total } } }] } }`

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host：`inject: ["webServer"]`，注册 `/usage-stats/api` 前缀路由，扫描并聚合会话日志 |
| `client.js` | Client（web）：`sidebar.panellist` 图标项 + `main` 键控面板（key = `usage-stats`） |
| `cordis.patch.yml` | bundle patch：向 profile 插入 `usage-stats` 插件行 |
| `locale/*.json` | 插件市场展示用标题/描述 |
| `icon.svg` | 面板图标 |

## 安装

```
plugin_manager install_bundle target=/home/jichong/Projects/dsh-plugins/usage-stats
```

安装后刷新浏览器页面生效。
