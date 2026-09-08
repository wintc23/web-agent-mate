# WebAgentMate

[English](README.md) | 简体中文

[![CI](https://github.com/wintc23/web-agent-mate/actions/workflows/ci.yml/badge.svg)](https://github.com/wintc23/web-agent-mate/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**让每个网页都能连接你的 AI 智能体。**

WebAgentMate 是一个开源 Chrome 助手，将本地 Codex、Claude Code 和基于 OrcaRouter 的内置智能体带到浏览器中。你可以在侧边栏或独立会话标签页里理解网页、总结翻译、执行浏览器任务，并结合本地文件完成工作。

会话保存在当前设备。所有智能体任务都经由本地 Bridge 执行；所选引擎仍可能将任务内容发送给云端模型服务。

**当前状态：** `main` 是 v0.6.0 开发源码，[GitHub Releases](https://github.com/wintc23/web-agent-mate/releases) 中的安装包可能落后于源码。体验本文功能时，请从同一份源码构建扩展和 Bridge。已完成验证及尚待真实模型验收的内容见[验收记录](docs/ACCEPTANCE-v0.6.md)。

## 可以做什么

- **理解网页：** 总结文章、解释选中文本、翻译、提取信息，或围绕当前页面继续追问。
- **执行浏览器任务：** 读取页面、导航、点击、填写、选择、滚动和截图，在会话中处理工具授权请求。
- **结合本地工作：** 选择工作目录，让智能体读取、搜索、编辑文件，运行获准的命令，将网页信息整理成文档。
- **切换智能体：** 在同一会话界面选择 Codex、Claude Code 或内置 OrcaRouter 智能体。
- **管理长期会话：** 独立草稿、搜索、改名、分支、删除，以及 JSON 备份导入导出；关闭再打开后可恢复历史。
- **使用更大工作区：** 将会话打开为独立标签页，同步侧栏与页面的草稿、进度、回复和停止操作。
- **使用原生 Codex 能力：** 模型与推理档位、执行/计划模式、权限设置、运行中追加指令、原生历史导入、Skills 和 MCP。具体范围见 [Codex 兼容说明](docs/CODEX-COMPATIBILITY.md)。
- **调整界面：** 跟随系统、浅色和深色主题；支持简体中文、繁体中文、英语、巴西葡萄牙语、日语和德语。

例如，你可以发送：

> 用五个要点总结当前页面，并解释其中的技术术语。
>
> 提取这篇文章的关键信息，在当前工作目录生成一份 Markdown 报告。

## 选择智能体

| 引擎 | 连接方式 | 使用前准备 |
| --- | --- | --- |
| Codex | 本机 Codex App Server，使用其原生工具和配置 | 安装 Codex CLI 并完成认证 |
| Claude Code | 通过 Claude Agent SDK 调用本机 Claude Code | 安装 Claude Code CLI 并完成认证 |
| 内置智能体 | 在本地运行工具循环，通过 OrcaRouter 调用模型 | 在设置中登录 OrcaRouter 或填写 API Key |

三种引擎都需要 **Bridge 和 Node.js 20+**。Codex、Claude 使用各自的认证；只有内置智能体需要连接 OrcaRouter。模型可用性、额度和费用取决于对应服务。

没有 Bridge 时仍可查看和管理已有会话、草稿，但不能启动智能体任务。

## 从源码安装

### 1. 准备环境

- Google Chrome，启用开发者模式以加载未打包扩展。
- Node.js 20+ 和 npm；CI 使用 Node.js 22。
- Rust stable 和 Cargo，用于构建 Bridge。Windows 还需 MSVC C++ 构建工具；macOS 需 Xcode Command Line Tools；Linux 需 C 编译器和链接器。
- 根据上表准备所选智能体的 CLI 或账号。

### 2. 构建并加载扩展

```bash
git clone https://github.com/wintc23/web-agent-mate.git
cd web-agent-mate
npm ci
npm run build
```

打开 `chrome://extensions`，启用**开发者模式**，点击**加载已解压的扩展程序**，选择刚生成的 `dist/` 目录，然后将 WebAgentMate 固定到工具栏。

### 3. 构建并安装 Bridge

在项目根目录执行与你的系统对应的命令。

**macOS：**

```bash
./scripts/build-bridge.sh
./scripts/install-native-host-macos.sh
```

**Linux：**

```bash
./scripts/build-bridge.sh
./scripts/install-native-host-linux.sh
```

**Windows PowerShell：**

```powershell
npm run build:runtime
cargo build --manifest-path bridge/Cargo.toml --release
.\scripts\install-native-host-windows.ps1
```

构建脚本会生成 Node runtime 和 Rust Bridge。安装器将它们复制到当前用户目录，并注册 `ai.webagentmate.bridge` Native Messaging 主机。安装后重启 Chrome 或重新加载扩展。

仓库中的公开 manifest key 将默认扩展 ID 固定为 `lmlkkallnnjijicmfmfdelnamcnhflfg`，无需手动配对。如果 fork 修改了 key，请将 `chrome://extensions` 中显示的 ID 作为安装脚本的第一个参数传入；PowerShell 使用 `-ExtensionId`。manifest key 是公开身份信息，不是签名私钥。

### 4. 开始第一段对话

1. 打开普通 HTTP(S) 网页，点击工具栏中的 WebAgentMate 图标。
2. 进入**设置**，检查 Bridge 连接；使用内置智能体时连接 OrcaRouter。
3. 打开模型/智能体选择器，选择引擎和模型；涉及文件操作时选择工作目录。
4. 输入“总结当前页面”，根据提示确认工具操作；需要中断时点击停止。
5. 在**会话**中切换历史记录，或将当前会话打开到独立页面。

## 使用发布包安装

从[同一个 GitHub Release](https://github.com/wintc23/web-agent-mate/releases) 下载扩展 ZIP 和对应系统的 Bridge ZIP，不要混用不同版本。扩展 ZIP 解压到固定目录后，通过 `chrome://extensions` 加载该目录。

v0.6 的发布工作流会生成以下文件；请以实际 release 中列出的文件和版本为准：

| 平台 | Bridge 文件 | 解压后运行 |
| --- | --- | --- |
| macOS Apple Silicon | `webagentmate-bridge-macos-arm64.zip` | `./install-native-host-macos.sh` |
| macOS Intel | `webagentmate-bridge-macos-x64.zip` | `./install-native-host-macos.sh` |
| Windows x64 | `webagentmate-bridge-windows-x64.zip` | `.\install-native-host-windows.ps1` |
| Linux x64 | `webagentmate-bridge-linux-x64.zip` | `./install-native-host-linux.sh` |

扩展包名为 `webagentmate-extension.zip`。预编译 Bridge 仍需要本机安装 Node.js 20+；v0.6 Bridge 包中包含 `runtime/agent.mjs` 和依赖许可证声明，需完整解压。

如果 macOS/Linux 解压后提示没有执行权限，在解压目录运行以下命令，再执行安装脚本：

```bash
chmod +x webagentmate-bridge install-native-host-*.sh uninstall-native-host-*.sh
```

这些包没有作为已签名安装器提供；未签名的 macOS 构建可能需要在系统设置中批准运行。

## 会话与长任务

每个会话独立保存草稿、消息、工具记录、模型与工作目录。搜索支持标题、消息、模型和路径。分支会话会保留原会话；切换引擎或工作目录也会建立分支，避免混用执行上下文。

JSON 备份包含对话、草稿和工具内容，不包含应用连接设置或原生 session ID。导入会创建新会话，不会自动执行任务。备份上限为 10 MB；其中可能包含对话里已有的敏感内容。

内置智能体默认不限制工具调用次数或任务总时长，可在会话配置中开启次数上限。连续工具失败或重复无进展的调用会暂停运行；单次模型请求仍有超时控制。

**运行由发起它的侧栏或标签页持有。** 从侧栏打开独立页面不会转移已经启动的任务；关闭原侧栏会停止该任务并保留历史。希望关闭侧栏后继续运行时，请在独立页面发起后续任务并保持该标签页打开。同一设备的多个窗口可以共享进度和控制，同一会话不能同时重复执行。

会话只保存在当前设备，不进行账号同步。删除扩展会话不会删除原生智能体自己的记录或已生成文件。

## 数据与隐私

- OrcaRouter Key 和界面设置保存在 `chrome.storage.local`，仅受信任的扩展上下文可以访问；会话和草稿保存在扩展 IndexedDB。
- 页面和本地文件中与任务有关的内容可能发送给所选模型服务。本地执行不等于离线推理。
- Bridge 使用 Native Messaging，不开放本地 HTTP 端口；内置 runtime 仅在运行时接收 OrcaRouter Key，Bridge 不持久化该 Key。
- 项目不包含广告或分析 SDK，不运营应用服务器。Codex、Claude 保留各自的配置、认证和原生记录。
- 可通过断开连接、删除会话或清除扩展数据移除相应数据；导出文件及原生智能体记录需要分别处理。

更多说明见 [PRIVACY.md](PRIVACY.md)，漏洞反馈方式见 [SECURITY.md](SECURITY.md)。

## 开发与验证

```bash
npm ci
npm run build
npm test
npm run build:runtime
cargo fmt --manifest-path bridge/Cargo.toml -- --check
cargo test --manifest-path bridge/Cargo.toml --locked
```

构建包含六种语言校验和 TypeScript 检查。自动化测试使用合成数据，不需要模型账号；推送到 `main` 和提交 PR 会触发 GitHub Actions 验证。`npm run dev` 可启动 Vite 进行界面开发；测试 Chrome 扩展 API 时请重新构建 `dist/` 并在 Chrome 中重新加载。

以下是可选的真实智能体检查，需要本机有效登录，会发起真实模型请求，可能产生费用：

```bash
node scripts/smoke-runtime.cjs codex --turn
node scripts/smoke-runtime.cjs codex --cancel --bridge
node scripts/smoke-runtime.cjs codex --bridge --large
node scripts/smoke-runtime.cjs claude --turn
```

当前真实模型验证的覆盖范围见[验收记录](docs/ACCEPTANCE-v0.6.md)。不要将模型目录可用视为推理认证成功。

推送 `v*` 标签会构建扩展及 macOS x64/ARM64、Windows x64、Linux x64 Bridge ZIP，并附加到 GitHub Release。源码更新与发布安装包是独立步骤。

## 常见问题

| 问题 | 处理方式 |
| --- | --- |
| Bridge 未连接或找不到 native host | 运行对应系统的安装脚本，核对扩展 ID 和两端版本，然后重启 Chrome。 |
| `NODE_20_REQUIRED` | 检查 `node --version`，确认 Node.js 20+ 安装在 Bridge 可发现的位置；仅在交互式 shell 中可见的版本可能无法被 Chrome 找到。 |
| `RUNTIME_BUNDLE_MISSING` 或要求更新 Bridge | 源码安装需重新构建 runtime、Bridge 并运行安装器；发布包需完整解压，保留 `runtime/`。 |
| Codex / Claude 不可用 | 确认 CLI 已安装且可被 Chrome 启动的进程发现，并先在终端完成一次有效的已认证请求。 |
| `CLAUDE_AUTH_REQUIRED` | 在终端运行 `claude auth login` 后重试。 |
| 无法读取 `chrome://` 页面 | 切换到普通 HTTP(S) 页面；浏览器内部页面和文件 URL 不在工具支持范围内。 |
| 关闭侧栏后任务停止 | 在独立会话页面发起后续任务，并保持发起任务的页面打开。 |
| OrcaRouter 提示限流或额度错误 | 按界面提示重试、选择模型、检查连接或账户额度。模型目录可访问不代表具有推理额度。 |

更新源码后，需要重新构建扩展和 Bridge、重新运行安装脚本，再重新加载扩展。卸载 Bridge 使用对应的 `scripts/uninstall-native-host-*` 脚本或发布包内的卸载脚本；扩展需在 Chrome 中单独移除。

## 项目结构

```text
src/                 侧栏、独立会话页面、浏览器工具和本地会话存储
public/              Manifest、图标和 Chrome 多语言消息
bridge/src/          Rust Native Messaging 主机、SQLite 存储和 runtime 生命周期
bridge/runtime/      Codex/Claude 适配与内置智能体、本地文件和命令工具
scripts/             构建、安装卸载、测试和可选真实模型检查
tests/               协议、会话、权限和错误恢复测试
docs/                设计、验收记录和集成范围
.github/workflows/   持续集成与发布打包
```

扩展负责浏览器工具，通过 Native Messaging 与 Rust Bridge 交换任务事件；Bridge 启动 Node runtime，再连接所选智能体。更详细的协议方法见[英文 README](README.md#bridge-protocol)。

## 参与贡献

欢迎通过 [GitHub Issues](https://github.com/wintc23/web-agent-mate/issues) 提交可复现的问题和功能建议，通过 Pull Request 贡献改进。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

问题报告请注明操作系统、Chrome 和 Node.js 版本、所选引擎、扩展与 Bridge 版本；日志中请移除凭据和私人页面、文件、会话内容。安全漏洞请按 [SECURITY.md](SECURITY.md) 私下反馈。

相关文档：[v0.6 设计](docs/PRD-v0.6.md) · [验收记录](docs/ACCEPTANCE-v0.6.md) · [Codex 兼容说明](docs/CODEX-COMPATIBILITY.md)。

## 许可证

WebAgentMate 自有源码采用 [MIT License](LICENSE)。第三方依赖保留各自的许可证和条款；Claude Agent SDK 受 Anthropic 条款约束。Runtime 包在 `runtime/licenses/` 中包含该 SDK 的许可证声明和 Zod 许可证。外部模型服务的使用另受相应服务商条款约束。
