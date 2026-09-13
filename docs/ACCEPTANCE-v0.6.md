# v0.6 实现与验收记录

日期：2026-09-07。环境：macOS x64、Node 24.20.0、Chrome for Testing 151、Codex 0.153.4。

方案和主体实现已完成，**尚未完成全部真实模型验收**。待办是 OrcaRouter 的真实工具循环，以及重新登录后 Claude 的工具调用、续聊和停止。模型目录可用不代表模型认证可用。会话仅在本机存储，没有跨设备同步。

## 需求对应

| 用户要求 | 已实现 | 验证结果 |
|---|---|---|
| 完整智能体 | 统一对话，流式文本、连续工具调用、工具结果反馈、计划、询问、停止、错误恢复 | 内置循环的可控协议测试通过；远端模型仍待 OrcaRouter 连接 |
| 本地连接 Codex / Claude | Codex App Server 与动态浏览器工具；Claude Agent SDK 与 MCP 浏览器工具；原生 session ID 持久化 | Codex 真实工具、跨进程续聊与停止通过；Claude 认证错误已定位并能提前返回 |
| 本地内置智能体 | Bridge 的 Node runtime 调用 OrcaRouter，共用内置循环，提供文件、精确编辑、搜索、命令与进程工具 | 真实临时文件和命令执行通过；模型驱动的文件任务待 OrcaRouter 连接 |
| 远端按浏览器能力提供工具 | 标签页、分页读取、导航、点击、填写、选择、滚动、截图、等待、计划、询问、文档产物 | 真实扩展 API 的读取、操作、保护、截图和导航通过；执行期间 Native Messaging 调用数为 0 |
| 会话管理，无需跨设备 | 创建、切换、草稿、搜索、筛选、改名、删除、分支、JSON 备份、原生身份隔离、运行所有权 | IndexedDB 自动化测试和浏览器界面验证通过 |

## 已通过的检查

- `npm test`：41 项通过。覆盖流式解析、断流、有限重试、连接/空闲超时、取消、压缩不破坏工具组、失败时保留历史、分片/缺片/乱序、参数校验、会话竞争和备份，以及真实文件编辑和命令执行。新增原生工具结果转换、断开连接后的迟到批准、完成时等待会话写入，以及忽略 SIGTERM 的后台子进程清理检查。
- `npm run build`：六种语言校验、TypeScript、Vite 通过。
- `npm run build:runtime`：runtime TypeScript 校验和 Node bundle 构建通过。
- `cargo test --manifest-path bridge/Cargo.toml`：7 项通过。
- `cargo build --manifest-path bridge/Cargo.toml --release`、Rust 格式、Shell 语法、`git diff --check` 通过。
- 构建仍有依赖注释和约 565 KB UI bundle 的提示，不影响构建成功；没有把这些提示记作测试失败或功能通过证据。

## 真实原生协议

```bash
node scripts/smoke-runtime.cjs codex --turn
node scripts/smoke-runtime.cjs codex --cancel --bridge
node scripts/smoke-runtime.cjs codex --bridge --large
node scripts/smoke-runtime.cjs claude --turn
```

- Codex 第一轮调用 `wam_update_plan`，客户端在工具结果中返回随机标识。关闭第一轮 runtime 后，以同一 native session ID 启动第二个进程；第二轮在工具参数和最终回复中成功使用这个标识。
- 部分恢复测试中模型没有发起第二轮工具调用，并回答上一轮没有验证标识。这一现象的根因尚未确定；运行器已改为先关闭 app-server 输入并等待退出，再执行有界强制清理，避免结束时直接终止写入。修改后经真实 Rust Bridge 的跨进程恢复通过。额外诊断使用第三个 app-server 进程执行 `thread/read`，确认随机标识确实存在于持久化工具结果，随后恢复的模型也成功在工具参数和回复中使用该标识。该验证不向恢复请求补入标识。
- 经真实 Rust Native Messaging，在浏览器工具等待结果时发送取消，返回 `cancelled`。
- 大于 1 MiB 的合成历史经有序分片进入 Rust Bridge，再由 runtime 重组，原生模型目录成功返回。测试还从生成的 ZIP 解压执行，验证同包的 `runtime/agent.mjs` 可用。
- Claude 的本地模型目录可读取，但直接 CLI 和 SDK 调用均遇到已撤销的 OAuth 令牌。诊断确认服务返回 401，CLI 原先反复重试。适配器现在识别 SDK 的认证失败/重试事件，返回 `CLAUDE_AUTH_REQUIRED`，不把目录成功当作推理成功。
- Codex 动态工具实际返回 `contentItems`，Claude 返回内容块数组。此前 UI 转换会丢失文档 JSON 或把它嵌套为内容块字符串，现已修复；失败标志和命令非零退出也会保留，截图的 base64 不写入可见会话记录。长且包含转义字符的文档 JSON 保留检查通过。
- 独立 Node 子进程测试复现了清理计时器不保活导致后台进程遗留的问题。修复后，运行器等到强制清理完成才退出，忽略 SIGTERM 并重定向全部输出的合成子进程也已终止。淘汰已结束的命令记录时也会清理其进程组。

## 真实浏览器工具

使用独立临时 Chrome 配置和 Playwriter CDP，载入构建后的扩展。测试驱动临时打包同一份 `src/agent/browser-tools.ts`，调用实际 `chrome.tabs`、`chrome.scripting` 和截图 API，没有模拟这些浏览器 API。

页面是仅监听 `127.0.0.1:4187` 的合成表单，包含文本输入、选择框、密码控件、按钮、状态文本、长正文和导航链接。

- 读取返回可操作元素与 `nextOffset`；第二页读取结束；密码测试值不出现在读取结果中。
- 填写文本、选择语言、点击按钮后，通过 Playwright 输入值和可见状态断言确认结果。
- 密码控件操作被拒绝；过期 snapshot 被拒绝；拒绝授权后没有执行导航。
- 首次截图实测发现缺少 Chrome 要求的权限。修正为 `<all_urls>` 并重新加载扩展后，`captureVisibleTab` 返回约 67 KB 的 JPEG 数据 URL。
- 文档工具返回正确文件名和内容；导航至测试 URL 成功。
- 这些工具执行期间 Native Messaging 调用数为 0。测试驱动的批准仅用于这张合成页面，不作为真实用户授权流程的替代。
- 之前的会话 UI 验证涵盖导入、分支、独立草稿、改名、搜索、筛选、导出和刷新恢复；该轮使用真实 IndexedDB、模拟 Chrome 连接接口。
- 此轮在实际扩展界面选择本地 Codex，读取原生模型列表，保存配置并发送任务。UI → Chrome Native Messaging → 已安装 Bridge → Codex → 扩展工具 → UI 全链路成功。Enter 发送和单击发送分别显示已完成的 `wam_update_plan`，并收到“连接测试成功。”及“单击发送成功。”。首次测试驱动超时后的一次发送立即中断，未确定原因且未计作通过；后续两个独立发送测试均通过。
- IndexedDB 中记录同一原生会话身份、两次成功工具调用和两次完整回复。复测发现首次创建会话时未立刻保存选中 ID，已修复；刷新后选中会话与两轮结果均恢复。
- 实际扩展 → 已安装 Bridge → Codex 调用 `wam_create_document` 后，界面出现“下载文档”。通过该按钮下载 `report.md`，断言文件名和完整 Markdown 内容与要求一致，浏览器日志无错误。
- 从实际扩展后台请求 OrcaRouter 公开模型目录成功，返回 170 个经过能力筛选的可选模型。这仅证明目录请求可用，不证明账户有可用推理连接。

截图证据保存在本机 `/tmp/webmate-browser-tool-capture.jpg`、`/tmp/webmate-session-management.png`、`/tmp/webmate-native-codex-session.png`、`/tmp/webmate-native-document.png`。下载校验文件为 `/tmp/webmate-native-document.md`。

## 构建产物与本机安装

- `release/artifacts/webagentmate-extension-0.6.0.zip`
- `release/artifacts/webagentmate-bridge-macos-x64-0.6.0.zip`
- `release/artifacts/checksums.json`

ZIP 完整性和必要文件检查通过。Bridge 包包含可执行文件、安装/卸载脚本、`runtime/agent.mjs`、项目许可证及 runtime 依赖声明。测试驱动文件没有进入扩展 ZIP。

本机已有 WebAgentMate Bridge 已更新至 0.6.0。旧二进制已备份，备份目录记录在 `/tmp/webmate-bridge-backup-path.txt`。在独立测试配置中注册同一已安装主机后，实际 Chrome Native Messaging 的 `bridge.hello` 返回 `version: 0.6.0`、`runtimeV2: true`。

发布工作流已补上 runtime 构建和打包步骤，并为 macOS x64/ARM64、Windows x64、Linux x64 配置构建。其他操作系统未在这台 Mac 上实际运行验证。未上传商店、发布 GitHub Release 或推送提交。

## 仍需完成

1. 在扩展设置中连接有可用额度的 OrcaRouter，分别验证浏览器模式的读取页面 → 操作 → 检查结果，以及本地模式的读取文件 → 编辑 → 命令验证；两轮继续会话及一次真实长上下文整理。浏览器模式于 2026-09-09 恢复，见文末记录。
2. 在终端运行 `claude auth login`，恢复有效登录后执行真实 MCP 工具、跨进程续聊与停止测试。
3. 以上完成后更新本记录，逐项复核并结束整体目标。当前不以模拟请求或目录读取代替这两项验收。

## 2026-09-08：回车意外打开设置页

- 原因：内置引擎未连接 OrcaRouter 时，发送前检查直接调用 `setSettings(true)`；回车和点击发送共用此分支。
- 修复：保留连接检查和聊天页内提示，移除自动导航，保留草稿与输入焦点。
- 在独立 Chrome for Testing 中载入实际扩展，先复现旧版本回车跳转，再验证修复后回车和点击发送均留在对话页、输入不丢失；Shift+Enter 只换行；主动打开设置再返回仍保留草稿。浏览器日志无错误。
- `npm run build` 的六语言检查、TypeScript 与 Vite 构建通过；扩展 ZIP 及校验和已更新。此修复不依赖 OrcaRouter 或 Claude 认证恢复。

## 2026-09-08：antd 界面与连接调整

- Agent 头像用于页头、欢迎页和智能体回复。会话改为左侧 antd Drawer，包含搜索、环境筛选、更多操作与备份；设置页移除会话入口，仅保留连接、外观与关于。
- 实际交互改用 antd Button、Input、Select、Segmented、Modal、Popover、Collapse 等。模型使用“服务商 → 模型”Cascader，可跨服务商搜索，并保留免费/付费及可用价格信息；320 px 窄侧栏实测弹层范围在视口内，搜索和选择 Claude Haiku 成功，没有发起模型请求。
- 输入框底部增加本地工作目录入口，可输入路径、浏览目录、返回上级与选择近期目录。Rust Bridge 的 `workspace.list` 只读取目录元数据，支持分页。在真实 Native Messaging 和实际扩展中选择了项目的 `src` 目录，草稿保持不变。
- OAuth 换取密钥成功后即保存，移除会导致单次授权被目录故障丢弃的后续目录请求；验证 API Key 也与公开目录分开。校验回调地址、state 和 API scope；浏览器授权失败保留原因。新增 API Key 输入、验证和明确错误提示，失败不会覆盖已有连接。
- `npm test`：44 项通过；`cargo test --manifest-path bridge/Cargo.toml`：8 项通过；六语言、TypeScript、Vite、Rust release 构建与差异空白检查通过。本机 Bridge 与扩展/Bridge ZIP 已更新。
- 实际扩展通过无效合成 Key 请求 OrcaRouter，收到拒绝提示，确认没有保存 Key。回车在未连接时仍停留聊天页；Drawer 的 Esc 关闭和草稿保留正常。深色设置页、400 px 对话/抽屉及 320 px 级联界面已检查。
- 实际扩展的“使用 OrcaRouter 登录”按钮经 `chrome.identity.launchWebAuthFlow` 成功打开 OrcaRouter 登录窗口；此测试使用未登录的临时 Chrome 配置，未代替用户完成账号登录或批准授权。
- OAuth 成功保存的故障测试使用受控协议模拟。有效用户账号登录、真实 OrcaRouter 推理及 Claude 重新登录后的验收仍需有效连接，不把模拟授权或公开目录请求记为完成。

截图：`/tmp/webmate-antd-chat.png`、`/tmp/webmate-antd-drawer.png`、`/tmp/webmate-antd-settings.png`、`/tmp/webmate-antd-settings-dark.png`、`/tmp/webmate-antd-workspace.png`、`/tmp/webmate-antd-models-320.png`。

## 2026-09-08：会话抽屉滚动条显隐抖动

- 原因：Drawer 的滚动容器未预留滚动条空间。独立 Chrome 实测长列表的可用宽度为 345 px，搜索至单条会话后变为 360 px，工具栏、搜索框、筛选器和列表随之伸缩 15 px。
- 修复：为 `.ws-session-drawer .ant-drawer-body` 添加 `scrollbar-gutter: stable`，保留按需滚动。
- 构建后的实际扩展在 400 px、320 px 视口中验证长列表 → 单条搜索结果 → 空结果 → 恢复列表，内容宽度与横向位置始终一致；本地/全部环境筛选同样通过。使用真实 IndexedDB 中的合成会话，未访问用户会话数据。
- 六语言检查、TypeScript、Vite 构建通过；扩展 ZIP 及校验和已更新。测量记录：`/tmp/webmate-scroll-measurements.json`；截图：`/tmp/webmate-scroll-fixed.png`。

## 2026-09-08：多窗口会话同步与目录恢复

- 原因：界面仅每 5 秒读取一次 IndexedDB，运行中的窗口还会跳过读取；停止和待回复请求只保存在发起窗口内。关闭窗口后若异步清理未完成，会留下 45 秒租约，界面把残留标记误报为“其他窗口运行”。
- 改为事务提交后通过 BroadcastChannel 通知同源窗口，同步消息、工具结果、草稿、队列和运行状态。停止、插队及问题/授权回复写入带运行 ID 的共享状态；事务只接受首个有效回复，停止后和旧运行的迟到操作均被拒绝。
- Web Locks 保护运行的整个生命周期，关闭或崩溃后由浏览器释放。恢复时先取得同一锁，不依据过期心跳抢占存活的任务；旧版标记在租约到期，或 Chrome 确认仅剩当前侧栏文档时恢复。恢复保留历史与队列，不自动执行未发送消息。
- 使用隔离 Chrome 配置中的两张实际扩展页面，实测草稿双向同步、窗口 B 回复窗口 A 的问题、B 排队后由 A 顺序执行、B 停止 A、关闭 A 后 B 继续操作，以及旧版残留状态恢复。停止传播实测 247 ms；关闭发起窗口后的恢复实测 79 ms。最后构建另行验证跨窗口拒绝授权，没有执行对应导航；关闭并重开另一个窗口没有覆盖最新草稿。
- 多窗口测试使用受控 SSE 模型响应，不消耗真实模型额度；IndexedDB、BroadcastChannel、Web Locks、Chrome 上下文检查和组件交互均为真实浏览器执行。问题/排队场景合计 3 次模型请求，无重复发送。
- 目录选择改为扩展页面直接调用 Native Messaging，不依赖后台是否包含新版目录路由。模拟后台目录请求空响应时，实际已安装 Bridge 仍成功列出项目目录并选择 `src`。模拟主机连接失败时显示可读错误和重试入口，不显示“没有子文件夹”；恢复连接后点击重试成功。
- `npm test`：50 项通过；六语言、TypeScript、Vite 构建和差异空白检查通过。扩展 ZIP 及校验和已更新。测试结果：`/tmp/webmate-sync-browser-results.json`；截图：`/tmp/webmate-sync-reply.png`、`/tmp/webmate-sync-recovered.png`、`/tmp/webmate-directory-error.png`。

## 对接依据

- [Codex App Server](https://learn.chatgpt.com/docs/app-server)：实验动态工具、工具回调、thread/resume。
- [Claude Agent SDK streaming input](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode)：输入流、会话与工具集成。
- [OrcaRouter tool calling](https://docs.orcarouter.ai/advanced/tool-calling)：兼容 OpenAI 的工具请求格式。
- [Chrome Native Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)：消息尺寸限制。
- [Chrome tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab)：截图权限要求。


## 2026-09-08：Codex 原生能力兼容

- 从本机 Codex 0.153.4 导出 App Server 类型核对协议，拆出 `bridge/runtime/codex.ts`。不再固定覆盖本机 sandbox、approvalPolicy 和 developerInstructions；会话可显式选择推理强度、服务档位、执行/计划模式与权限。
- 支持原生 `turn/steer`，附带活动 `expectedTurnId` 和消息标识；Enter 保留排队，Ctrl/⌘+Enter 或追加按钮进入当前轮。跨窗口请求由持有运行锁的窗口发送，确认事件持久化后才从队列移除；未确认结果和崩溃期间发送中的消息不会自动重发。
- Skills 目录按工作目录读取，可插入原生技能输入或启用/停用。MCP 展示认证与工具/资源目录，标准表单和 URL 授权可回复。原生会话支持搜索、分页读取、导入为独立分支，以及后续原生恢复；现有分支也保留完整 Codex 上下文。
- 显示计划、推理摘要、文件差异、命令增量输出、用量、上下文压缩及子智能体/Hook 活动。子线程完成事件不会结束主轮次。移除 Codex 的通用 15 分钟总限时与 3 分钟静默限时，保留启动和 RPC 超时。
- `npm test`：61 项通过，包括真实子进程协议夹具、设置/备份、MCP 字段约束、重复确认幂等、未确认追加恢复，以及 Native Messaging 的落盘顺序与断连清理；TypeScript、六语言检查、扩展和 runtime 构建通过。
- `node scripts/smoke-codex.cjs --turn` 使用本机真实 Codex：7 个模型（含推理档位）、9 个 Skills、1 个 MCP 服务；在真实浏览器工具调用期间成功追加指令，最终回复含唯一标识；分页读取持久化历史，原生 fork 能回忆原标识。记录 `/tmp/webmate-codex-smoke-results.json`。
- 实际 Chrome 扩展通过真实 Native Messaging 读取模型推理档位、Skills、MCP（49 个工具、29 个资源），搜索并导入合成测试原生会话，恢复 5 条记录和原生分支来源。未修改或恢复用户原有终端会话。
- 完整范围和未覆盖的终端专属交互见 [CODEX-COMPATIBILITY.md](CODEX-COMPATIBILITY.md)。本机 MCP 使用 bearer token，本轮没有执行真实 OAuth 账户授权；表单/授权协议与界面验证与真实账户授权分开记录。

- 最终构建的两窗口真实 Chrome 测试使用受控 Native Messaging 事件：B 提交的 MCP 表单 `{count: 2, consent: false}` 正确传给 A；B 的追加按钮触发 A 恰好一次 control 请求，未启动第二轮或发送 interrupt，历史仅一条对应用户消息；B 可停止 A。Ctrl+Enter 发出的第二条追加故意丢弃确认，关闭 A 后 B 恢复操作，消息保留为 `uncertain` 且没有自动执行。界面、IndexedDB、BroadcastChannel 和 Web Locks 使用实际实现。记录 `/tmp/webmate-codex-browser-results.json`，320 px 截图 `/tmp/webmate-codex-steer-320.png`、`/tmp/webmate-codex-recovered.png`。

- 增补 MCP OAuth 回调子进程测试、切换工作目录/首次发送前分支的原生上下文保留，以及旧 runtime 兼容测试。新版目录请求对旧 runtime 只触发模型目录读取，随后提示更新 Bridge，避免被旧版误解成推理任务。

## 内置长任务与独立页面（2026-09-08）

- `npm test`：72 项通过。新增旧配置与备份的可选预算、40 次正常调用、达到预算时同批剩余调用明确不执行、恰好达到预算后回答、连续失败与恢复、忽略快照 ID 的重复序列、活跃进程轮询、图片进展、取消，以及独立页面复用不重载等验证。
- `npm run build`、`npm run build:runtime`、六语言与 TypeScript 检查通过；Vite 仍报告已有的大 chunk 提示。`git diff --check` 通过。
- 启动实际 runtime bundle，使用受控 SSE 和浏览器工具回复执行 40 次调用；把旧 180 秒静默计时器加速到 100ms，第二次模型响应延迟 200ms，任务仍成功完成，验证浏览器工具回复不会重新启用通用静默计时器。记录 `/tmp/webmate-builtin-runtime-results.json`。此项没有调用真实 OrcaRouter 模型。
- 隔离 Chrome 中用真实扩展界面、IndexedDB、BroadcastChannel、Web Locks 与受控 SSE 验证：次数开关默认关闭，开启后保存 5 次并刷新仍保留；旧 `maxSteps:24` 会话成功执行 40 次工具操作和一次询问；等待回复时确认没有 15 分钟整轮定时器。
- 顶栏打开当前会话的独立标签页，重复点击复用同一页面；草稿同步、独立页面回复侧栏提问、侧栏停止独立页面任务均通过。独立页面切换会话后更新 URL，其他窗口更改全局最近会话后刷新仍恢复 URL 中的会话。在独立页面发起任务后关闭侧栏，任务继续并完成。
- 独立页面根容器实测占满 1600×950 内容区；320px 窄窗口宽度保持 320px。截图 `/tmp/webmate-full-page-1600.png`、`/tmp/webmate-full-page-320.png`，浏览器结果 `/tmp/webmate-limits-browser-results.json`。浏览器控制台无新增错误。
- 更新已安装本机 runtime，并核对其内容与构建一致；更新扩展和 macOS x64 Bridge ZIP，验证 ZIP 条目内容和 SHA-256 清单。未发布。
- 打开独立页面不会转移已启动的运行连接；若任务由侧栏发起，关闭该侧栏仍按现有规则停止并保留历史。需持续使用独立页面时，应在独立页面发起后续任务。


## 2026-09-08：仅保留本地智能体与 OrcaRouter 错误操作入口

- 所有新任务通过本机 Bridge 执行，保留 Codex、Claude Code、内置 OrcaRouter 三种引擎。移除环境切换和会话环境筛选、后台旧 OrcaRouter 推理入口；模型目录和账户连接仍由扩展请求。设置页优先展示 Bridge，OrcaRouter 仅用于内置引擎。
- 旧浏览器内置会话和备份自动迁移到本地，保留记录、草稿、队列和运行标记；旧浏览器自动授权重置为询问，不自动启动任务。无 Bridge 时保留草稿并在聊天页提示安装或更新。
- OrcaRouter 错误在本地运行时分类为结构化原因，不传递原始响应、密钥或服务端提供的跳转地址。六语言卡片区分限频、免费输入限制、免费容量/用量、余额、Key 额度、成员预算、周期限额、访问权限和服务故障；根据原因提供重试、切换模型/Agent、较短会话、控制台、账单或连接入口。连接验证也采用相同原因分类。
- 按 [OrcaRouter 错误说明](https://docs.orcarouter.ai/operations/errors) 区分免费 429：有 Retry-After 显示恢复时间并禁用提前重试；明确无该头时提示单次输入限制；旧错误/流式错误无法确认响应头时不猜测恢复时间。不自动重试限频，不自动切换付费模型。周期限额不会引导用户通过充值解决。
- `npm test`：82 项通过；包括真实 IndexedDB 迁移、备份兼容、旧执行入口拒绝、HTTP/流式错误、Retry-After、UTC 重置时间、敏感信息移除、终止性错误不自动重试。六语言、TypeScript、Vite、runtime 构建通过；Vite 保留已有大 chunk 提示。
- 在隔离 Chrome for Testing 中加载实际扩展，使用真实 Native Messaging、Bridge 二进制、当前 runtime、浏览器工具与本地文件工具。仅模型 HTTP 响应由 runtime 进程中的受控夹具提供；连接状态映射到专用测试主机的真实 hello 结果。没有调用真实 OrcaRouter 模型或消耗用户额度。
- 完整链路执行 browser_tabs → fs_read → ask_user → 回答，模型实际收到 17 个浏览器和本地工具。侧栏发起的问题由独立页面回复，两窗口都收到结果。浏览器直接模型推理请求数为 0。
- 实测限频按钮倒计时禁用，到时恢复后仍不自动请求；点击重试可完成后续任务。错误卡片在两窗口同步；切换模型入口打开配置而错误本身不自动打开弹窗；输入过长时无原样重试按钮，新建较短会话保留原会话；Key 额度跳转控制台且无余额充值入口，周期限额显示准确本地重置时间。400 px 与 320 px 卡片已检查，浏览器日志无新增错误。
- 本机 runtime 与扩展/Bridge ZIP 更新并校验；测试临时主机和浏览器配置已清理。未发布。真实 OrcaRouter 可用账户推理和 Claude 登录验收仍按上文记录，不以受控响应代替。

本机证据：`/tmp/webmate-local-only-browser-result.json`、`/tmp/webmate-orca-rate.png`、`/tmp/webmate-orca-cycle-narrow.png`、`/tmp/webmate-local-only-config.png`。

## 2026-09-09：浏览器内置循环与可选 Bridge 安装入口

- 新会话默认由扩展页面执行内置 OrcaRouter 循环，浏览器工具和 IndexedDB 检查点直接在扩展内处理，无需安装 Bridge 或 Node.js。此变更取代 09-08 的全本地执行方案。选择“本机文件与命令”或 Codex / Claude 时仍使用 Bridge；不自动降级或改变所选模式。当前可选 Bridge 运行时仍依赖 Node.js 20+。
- 既有浏览器/本地会话及备份保留原环境、记录、草稿、队列、权限和运行所有权。开启本机能力时自动授权重置为询问；更改已有会话的执行环境创建分支。任务仍由发起它的页面持有，关闭后不自动重放未确认操作。
- 设置页、本机会话及目录选择中的缺失提示提供 Bridge 下载和安装说明；设置及会话入口可以重新检测连接。中英安装说明随扩展打包并在弹窗内打开，不依赖新文档先发布到 GitHub。下载入口指向项目 Releases；说明明确旧 v0.2.x 包不包含 v0.6 运行时。
- `npm test`：86 项通过。覆盖无 Native Messaging 的浏览器工具与续聊、模型返回文件工具时的拒绝、取消授权后的零导航、未知结果恢复、环境切换及备份兼容。进程清理测试原先依赖 300 ms 内启动的竞态改为等待测试子进程发出就绪标记。
- 六语言、TypeScript、扩展 Vite 构建和 Bridge runtime 构建通过。Vite 保留已有大 chunk 提示。
- 隔离 Chrome for Testing 加载实际扩展，以受控 SSE 响应完成 browser_tabs → browser_read → 回复，实际读取测试网页并将结果送入下一次请求；扩展页面的 Native Messaging 连接数为 0。重新检测触发状态读取；本机模式缺少 Bridge 时阻止发送、保留草稿并显示安装入口。400 px / 320 px 布局检查通过。
- 本轮未使用真实模型账户，也未发布新的 GitHub Release 或上传商店；真实服务验收沿用上方待办。源码构建已更新本地 `dist/`。

## 2026-09-09：设置分类

- 设置分为“模型服务”“本机能力”“通用”“关于”，六种语言均提供分类标签。设置入口及会话中主动点击的连接修复入口打开模型服务；Bridge 安装和检测集中在本机能力。语言和主题移至通用，关于增加项目与隐私链接。
- 佣金说明在浏览器登录按钮上方常显，信息提示保留。分类切换保留尚未提交的 API Key，连接错误只显示在模型服务；返回聊天保留草稿并恢复设置按钮焦点。
- `npm run build`、`git diff --check` 通过；`npm test` 86 项全部通过。Vite 仍提示已有的大 chunk 和依赖中的 `use client` 指令。
- 独立 Chrome for Testing 验证实际构建、IndexedDB 和组件交互：六语言在 320 px 下四个分类均可见且内容无横向溢出，1280 px 独立页面内容限制在 680 px；键盘切换、API Key 输入保留、连接错误定位、Bridge 检测、登录/验证/断开按钮、语言与主题持久化、返回后的草稿和焦点检查通过。浅色/深色截图已查看。Chrome 连接接口使用合成响应，本轮未发起真实登录或模型消费。
- 本次界面检查脚本与截图保存在本地忽略目录 `.test-output/settings-ui.cjs`、`.test-output/settings-*.png`。

## 2026-09-09：参考 Rumy 调整设置布局

- 参考本机 Rumy 的 `src/SidePanelApp.tsx`、`src/side-panel.css` 和设置截图，将顶部横向分类改为紧凑标题栏、左侧纵向导航和右侧独立滚动内容。保留现有四个分类及常显推广说明，通用偏好采用行式卡片，关于采用左对齐介绍与隐私卡片。
- 按设置容器实际宽度适配：超过 560 px 时显示 150 px 图标加文字导航，窄容器使用 48 px 图标栏。图标按钮保留可访问名称和名称提示，支持 Tab/Enter 导航；隐藏分类保留已输入的 API Key，右上角关闭返回聊天并恢复焦点。
- 构建、六语言检查、86 项测试和差异空白检查通过。独立 Chrome for Testing 检查六语言 320 px、400 px 侧栏、1280 px 页面及宽页面内 480 px 容器，导航宽度按容器变化且无横向溢出；浅色/深色、分类切换、连接反馈、API Key 输入、Bridge 检测、语言/主题持久化、关闭后草稿保留及连接修复定位通过。Chrome 连接接口继续使用合成响应。
- 已查看宽窄布局截图，包括 `.test-output/settings-models-320.png`、`.test-output/settings-wide-general.png` 和 `.test-output/settings-wide-about.png`。

## 2026-09-09：图形安装器与直接下载

- Bridge 增加 macOS Intel / Apple Silicon DMG、Windows x64 EXE、Linux x64 DEB/RPM 的打包代码及发布工作流。安装包包含固定版本且经 SHA-256 校验的私有 Node 运行时，Bridge 优先使用包内 Node。此项取代上方“可选 Bridge 仍要求用户安装 Node.js”的开发状态；源码开发仍需要 Node。macOS/Windows 安装到当前账户，Linux 使用系统软件包安装。
- 下载按钮使用真实系统信息选择安装包，允许切换平台和 Linux 格式。它查询与扩展版本一致的 GitHub Release，通过 Chrome downloads API 下载确切的项目文件；缺少该版本、网络失败和已开始下载分别反馈，不跳转 GitHub 页面。新增 `downloads` 权限并更新隐私说明、商店权限说明、中英 README 和内置安装指南。
- 本机实际生成 `release/artifacts/webagentmate-bridge-macos-x64.dmg`，48,674,454 字节。只读挂载 DMG，使用其中的真实 payload 在隔离账户目录完成安装、升级、Native Messaging hello、agent bundle 加载和卸载登记；会话夹具保留。PATH 中没有用户安装的 Node，Bridge 使用包内运行时连接成功。本轮没有替换当前用户已安装的 Bridge。
- `npm test`：92 项全部通过；Rust 8 项测试、release 构建、格式检查通过。最终扩展构建、TypeScript、六语言、安装脚本语法、工作流 YAML 和差异空白检查通过。Vite 保留已有的大 chunk 提示。
- 隔离 Chrome for Testing 加载实际扩展，读取真实平台信息。GitHub API 使用受控的未发布、服务失败和匹配资源响应；第一个下载保留真实 Chrome downloads API，只将 URL 改向本地实际 DMG。下载完成且 SHA-256 与源文件一致，未运行下载文件。其余平台记录实际按钮交付的文件名及 GitHub 直链，确认五种格式均匹配、没有新增标签页。验证失败后可重试、键盘打开菜单、320 px/400 px 布局、内置无命令安装指南；没有页面错误。
- 本机证据：`/tmp/webmate-installer-real-install.log`、`/tmp/webmate-installer-ui-results.json`、`/tmp/webmate-installer-download-400.png`、`/tmp/webmate-installer-menu-320.png`。DMG SHA-256：`51064a6fefdbcb7ffa3e4671e9fe5a85aa4e150603bb562ff654b064c446b3fa`。
- 尚未发布新 Release。此本机 DMG 为开发签名，未完成 Developer ID 签名或 Apple 公证；Mac ARM 构建、Windows EXE 与 Linux 软件包的目标平台检查尚未实际运行。CI 已配置两种 Mac 架构的安装/升级检查、Windows 静默安装/卸载、Linux DEB 安装/卸载和 RPM 构建/元数据检查；RPM 实际安装及各平台图形流程仍需桌面验收。公开发布会检查 macOS 签名/公证及 Windows 签名，配置方式见 [INSTALLER-DEVELOPMENT.md](INSTALLER-DEVELOPMENT.md)。

## 2026-09-10：文件夹下载入口、紧凑会话列表与多语言安装说明

- Bridge 不可用时，文件夹入口显示灰色背景及下载提示，鼠标点击或键盘 Enter 直接下载匹配安装器，并反馈已开始、尚未发布或失败；共享下载逻辑防止同一入口重复请求。Bridge 可用时保留目录浏览与选择，不触发下载。下载不改变草稿和会话配置。
- 移除会话列表的导入备份按钮、隐藏文件输入及对应界面处理，保留导出、搜索、分支、改名和删除。普通及分支会话统一为两行，实测高度从最小 66 px 调整为 52 px；分支来源由标题旁图标的提示和可访问名称提供。悬停背景覆盖整行，内部选择按钮保持透明，选中背景在悬停时保持一致。
- 设置中的“本机能力”改为“本地连接”，其他五种语言同步。安装说明独立提供英语、简体中文、繁体中文、日语、德语和巴西葡萄牙语，跟随当前界面语言；覆盖下载、三类系统安装、启动、更新和卸载，不再混排中英文文档。
- `npm test` 92 项通过；最终 TypeScript、六语言检查、扩展构建与差异空白检查通过。Vite 保留已有大 chunk 和依赖注释提示。
- 隔离 Chrome 加载实际扩展构建，使用真实 IndexedDB、设置、组件和平台识别。GitHub 资源响应、Chrome 下载调用和目录返回使用受控夹具，本轮没有请求真实模型或安装新 Bridge。验证键盘直接下载、重复点击只有一次请求、未发布/失败后重试、草稿保留、连接可用后的目录浏览与选择。
- 实测七条会话（含分支）在 320 px、浅色和深色下均为 52 px；整行悬停/选中颜色匹配主题，内部按钮不叠背景，搜索和键盘切换保留草稿。六种语言的设置名称和安装正文均匹配，安装弹窗在 320 px 下无横向溢出；页面无异常。证据为 `/tmp/webmate-ui-polish-results.json`、`/tmp/webmate-ui-polish-list-light-320.png`、`/tmp/webmate-ui-polish-list-dark-320.png` 及 `/tmp/webmate-ui-polish-guide-*-320.png`。
- 本地 `dist/` 已更新，未发布或推送。安装包发布和签名状态沿用上节；匹配安装包未发布时，下载入口明确提示未发布。

## 2026-09-10：连接助手文案与独立页面图标行为

- 设置卡片由技术名称改为“连接这台电脑”，操作为“下载连接助手”，状态为“已连接 / 未连接”。说明直接介绍访问电脑文件、运行命令、连接 Codex / Claude Code 的用途，并说明网页任务无需安装。文件夹提示、连接失败提示和安装说明同步六种语言；内部主机标识和下载文件名保留兼容。
- 安装器应用名称统一为 WebAgentMate Connector，中英 README、安装文档和商店说明同步。macOS DMG 已重新生成，使用新名称应用内的实际 payload 在隔离账户目录验证安装、升级、runtime 加载、Native Messaging hello 和卸载登记；PATH 不包含用户 Node，未修改当前账户的安装。其他平台构建及正式签名、发布状态沿用前述待办。
- 当前标签页为独立会话页面时，点击 Chrome 工具栏扩展图标会新增同一会话的标签页；普通网页仍打开侧栏。直接调用侧栏 API 保留用户手势，声明最低 Chrome 116。原独立页面不导航、不重启任务，既有会话运行所有权约束继续生效。
- `npm test` 94 项通过，包含重复打开、含特殊字符的会话 URL、无会话参数、缺失/无效/相似 URL 及侧栏同步调用检查。最终六语言、TypeScript、扩展构建、安装脚本语法、工作流 YAML 和差异空白检查通过。
- 隔离 Chrome 加载实际扩展，检查六语言的卡片和安装指南在 320 px 下无横向溢出；修正德语标题中途断词，检查中日德截图及浅色/深色主题。400 px 下验证下载按钮文案、下载后的反馈和重新检测显示“已连接”。此轮连接与 GitHub 资源响应、下载调用使用受控夹具，没有真实模型请求。
- 浏览器中调用同一份工具栏处理函数，通过真实 Chrome tabs API 连续创建两个不同标签页，确认会话 URL 和草稿一致、原页面标记与 timeOrigin 不变。自动化未模拟点击浏览器工具栏本身；普通网页打开侧栏的同步调用由单元测试覆盖。证据：`/tmp/webmate-connector-ui-results.json`、`/tmp/webmate-connector-tab-results.json`、`/tmp/webmate-connector-card-*-320.png`、`/tmp/webmate-connector-card-zh_CN-400.png`、`/tmp/webmate-connector-install-check.log`。
- 本地 `dist/` 已更新，未推送或发布；新版安装包尚未公开，macOS 本地 DMG 仍为未经公证的开发构建。

## 2026-09-10：Codex 标签页切换与闪动

- 排查发现，Codex 设置的标签页在隐藏时销毁，重新访问会再次调用列表接口；每次接口调用经连接助手启动新的 Codex App Server 并初始化，技能读取还强制重扫。居中弹窗根据不同内容高度重新定位，使加载和切换期间出现明显位移。
- 标签页按需首次读取，保留当前工作目录下的列表、搜索条件和分页状态，切回不再重建请求。进行中的只读请求可以完成并留在原标签页；交互操作在离开时取消，关闭弹窗或改变工作目录会取消旧请求并清除相应状态。新工作目录下尚未打开的标签页不提前发起读取。
- 关闭切换动画，隐藏页立即退出布局。Codex 内容区保持固定高度并在内部滚动，按视口限制大小。加载状态提供六语言提示，首次读取不闪现“暂无结果”；刷新保留旧列表。只读请求超过 45 秒提供可重试反馈，技能强制重扫仅由刷新按钮触发，技能/MCP 搜索不再为本地过滤重新启动读取。
- `npm run build`、六语言、TypeScript 和差异空白检查通过；当前自动化测试 99 项通过。此轮未修改或重打包本地运行时，没有发起真实模型请求或操作用户的 Codex 配置。
- 在隔离 Chrome 中使用真实扩展、IndexedDB 和 UI，Native Messaging 数据以受控目录、列表及延迟响应提供。旧版按技能 → MCP → 历史各访问两次产生 6 次列表请求，修正后仅 3 次。500 ms 响应夹具下旧版每次等待约 0.8–1.2 秒，修正后回切约 0.1–0.2 秒；这些时间包含自动化交互开销，不代表真实 Codex 首次启动耗时。
- 相同 800 × 850 视口下，修正后六次切换的弹窗顶部均为 94 px、高度均为 662 px；旧版顶部随列表类型在约 159–187 px 间变化，加载中也发生变化。验证待返回请求的快速来回切换无重复请求、搜索词保留、手动刷新保留列表、切换目录取消旧请求且按新目录加载、关闭弹窗取消隐藏页请求。加速的超时夹具验证错误反馈及重试恢复；六语言 320 × 640 和 320 × 480 短窗口布局通过，已检查中日德及浅色/深色截图，页面无异常。
- 证据：`/tmp/webmate-codex-tabs-before.json`、`/tmp/webmate-codex-tabs-after.json`、`/tmp/webmate-codex-tabs-lifecycle.json`、`/tmp/webmate-codex-tabs-locales.json`、`/tmp/webmate-codex-tabs-stable-800.png`、`/tmp/webmate-codex-tabs-loading-*-320.png`。首次读取仍需要本地 Codex 返回；本次没有改为常驻 Codex 服务。`dist/` 已更新，未推送或发布。

## 2026-09-10：OrcaRouter 仅保留浏览器登录

- 移除设置中的 API Key 输入和连接方式切换，以及消息类型和后台的 `auth:key` 处理入口。旧入口请求返回不支持，不能写入或覆盖连接凭据；浏览器登录的 PKCE、回调、scope 和凭据校验继续保留。
- 清理专用样式、无用文案和手动连接说明；连接失效或登录失败提示引导重新登录。验证连接、断开连接和现有凭据读取继续可用。
- 99 项测试、六语言检查、TypeScript、扩展构建与差异空白检查通过。实际构建的浏览器检查覆盖取消、失败、键盘重试、连接验证和断开；中文浅色、英文深色的 320 px 界面均只显示登录入口。Chrome 连接接口使用受控响应，未发起真实登录或模型请求。
- `dist/` 已更新，未推送或发布。界面证据：`.test-output/orca-login-only-320.png`、`.test-output/orca-login-only-en-dark-320.png`。

## 2026-09-10 发布准备补充

- 扩展构建及 99 项 Node 测试通过；连接助手运行时构建、Rust 格式检查及 8 项 Rust 测试通过。补充 `tsconfig.runtime.json` 的 Chrome Side Panel 类型声明范围，修复运行时构建的 `sidePanel.open` 类型错误。
- 使用独立 Chrome for Testing 实际加载构建产物；公开模型目录正常返回，DeepSeek 提供商可以展开、选择并保存。商店截图来自实际扩展界面，无用户凭据或私密聊天；任务草稿没有发送。
- 商店 ZIP 已准备：`release/artifacts/webagentmate-chrome-0.6.0.zip`，16 个运行文件，根目录 manifest，所有图标与六种语言文件存在；ZIP 完整性检查通过，无源码、source map、文档或连接助手安装包。
- [网站作品页](https://wintc.top/products/webagentmate)已发布，当前状态为开发预览；已上传图标和 3 张实际产品截图，附安装入口和推广说明。
- 中英文 README 置顶推广注册链接。独立浏览器验证注册页接收项目 `ref` 并存储；未创建测试账号、消费或验证佣金结算。
- Chrome Web Store 尚未提交；本轮未连接到用户已登录的浏览器。OrcaRouter 合作后台的最新 `app_id` 与回调登记状态也尚未重新核实。

## 2026-09-10：自有浏览器工具规则与推广文案

- 根目录 `AGENTS.md` 规定开发智能体优先使用 WebAgentMate 工具，除非用户明确指定，否则不使用 Playwriter。插件内的共用浏览器指令由内置智能体、Claude 和 Codex 加载；Codex 在新建、续聊和分支会话时追加规则，并保留有效工作目录的原有开发者指令。
- 100 项测试通过，覆盖上述三种 Codex 会话入口的指令合并、权限继承和用户输入保留。扩展构建、六语言、TypeScript、连接助手运行时构建通过；Vite 保留已有大 chunk 提示。
- 使用当前安装的 Codex CLI 0.153.2 启动真实 App Server，读取有效配置并创建临时会话，确认接受追加指令和自有动态工具，且 `instructionSources` 包含本项目 `AGENTS.md`。未启动模型轮次，没有验证模型遵守率；规则不是执行层禁用机制。
- 中英文 README、隐私说明、商店文案及线上作品页移除关于未提供奖励、额度的声明，保留实际佣金关系。作品页通过后端更新并读回确认。本轮未使用 Playwriter；当前外部会话尚未接入 WebAgentMate 浏览器工具，商店提交和合作后台核实仍待该接口可用。

## 2026-09-11：所有连接助手包自带 Node，保留本机 Node 环境

- 图形安装器和 ZIP 共用完整 payload，必须包含私有 Node、agent bundle 和许可证。ZIP 改由统一脚本生成并解压验证，发布检查要求四个平台 ZIP 的运行验证记录与文件 SHA-256 一致，阻止旧包或验证后被改动的包进入发布。
- 已安装 Bridge 仅使用其私有 Node，缺失时提示重新安装完整连接助手。维护者的未安装源码构建仍可使用开发环境 Node。Bridge 通过绝对路径启动内置 Node，不向运行时或项目命令 PATH 插入私有目录，不修改用户的 Node、npm、版本管理器或 shell 配置。
- ZIP 安装脚本直接调用包内 Node 和共用安装器，安装前验证完整性。源码安装脚本先生成包含私有 Node 的完整 payload。更新 README、安装指南、平台打包文档和项目规则，移除要求最终用户单独安装 Node 的旧说明。
- 102 项测试、8 项 Rust 测试、Rust release 构建、runtime 构建、Rust 格式和 shell 语法检查通过。macOS x64 完整 ZIP 解压后的真实 Bridge 在空 PATH 下可连接；真实 runtime 可加载；隔离探针确认运行时使用内置 Node，项目 shell 使用用户的 Node；删除内置 Node 后，即使系统 Node 存在也拒绝启动。
- 使用完整 payload 在隔离账户目录验证安装、升级、运行时加载和卸载登记，会话文件保留。当前账户已安装的连接助手未被替换。其他平台的实际打包验证通过 Release 工作流执行；正式签名、公开发布和自动更新状态不因这些本地检查而改变。Bridge 当前仍需用户打开新版安装器完成升级。
- 跨平台结果：[Release 工作流 34603906776](https://github.com/wintc23/web-agent-mate/actions/runs/34603906776) 全部通过，代码提交 `ee096e1`；扩展构建、Mac Intel / Apple Silicon DMG 安装升级与 ZIP、Windows EXE 安装卸载与 ZIP、Linux DEB 安装卸载与 ZIP 均经过实际执行，RPM 完成构建和摘要检查。验证脚本使用第二套真实 Node，确认项目 shell 的 Node 选择和文件内容保持不变。Windows 最初的验证命令引号问题已修正；Linux 多账号迁移继承错误 XDG 路径的问题已修复。Mac ARM64 一次 DMG 生成遇到空间不足，单独重跑后通过。
- 本地完整 Mac Intel ZIP 和 DMG 已重新生成，替换原先缺少私有 Node 的开发 ZIP。实际 ZIP 安装脚本在不含 Node 的 PATH 下完成安装及升级，shell 配置保持不变。工作流通过手动触发，仅生成开发产物，`publish` 未执行；新版安装包仍未正式公开发布。

## 2026-09-13：连接助手自动更新

- 更新器使用独立进程和进程组，下载固定仓库中与扩展版本匹配的签名清单及完整 ZIP；校验 Ed25519 签名、版本、平台、架构、下载大小和 SHA-256。更新包包含私有 Node，项目命令继续使用原有 PATH。
- 原生启动器按版本选择独立目录；所有原生连接共享系统文件锁，切换版本等待排他锁。下载可与任务并行，安装等待本地任务结束。切换前后均加载真实 runtime，失败恢复旧版，未确认的切换在下次启动时回滚。
- 设置中的自动更新开关、检查按钮、下载/等待/安装/回滚提示及安装指南支持六种语言。Chrome 在启动、扩展升级、成功连接和每六小时的 alarm 中触发检查；状态与节流保存在本机。仅可见的更新设置卡片读取进度，不引起整个会话界面重新同步。
- 110 项 Node 测试、9 项 Rust 测试、扩展和 runtime 构建通过。本地真实 macOS Intel payload、DMG 内安装/升级及完整 ZIP 的私有 Node/PATH 隔离验证通过。更新验证覆盖并发请求只启动一个 worker、任务连接阻止切换、强制终止原生宿主进程组后 worker 继续运行、损坏 runtime 回滚、未确认切换恢复以及用户数据保留。
- 发布公钥已固定在 payload；私钥未进入仓库，已配置 GitHub Actions 的 `WAM_UPDATE_SIGNING_KEY`。发布流程生成并校验签名清单，仍保留 macOS 签名/公证及 Windows 签名要求。
- 本次没有使用 Playwriter。当前外部会话未接入 WebAgentMate 浏览器接口，新增设置界面的验证为类型检查和构建；没有声称完成真实 Chrome 设置界面验收。
