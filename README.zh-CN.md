# WebAgentMate

[English](README.md) | 简体中文

> **[注册 OrcaRouter（推广链接）](https://www.orcarouter.ai/register?ref=ref_22606f54f9038927f996)**
>
> 通过此链接或 WebAgentMate 的浏览器登录入口注册，后续符合条件的消费可能为开发者带来佣金。详见[隐私说明](PRIVACY.md)。

[![CI](https://github.com/wintc23/web-agent-mate/actions/workflows/ci.yml/badge.svg)](https://github.com/wintc23/web-agent-mate/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**让每个网页都能连接你的 AI 智能体。**

WebAgentMate 是一个开源 Chrome 助手，将本地 Codex、Claude Code 和基于 OrcaRouter 的内置智能体带到浏览器中。你可以在侧边栏或独立会话标签页里理解网页、总结翻译、执行浏览器任务，并结合本地文件完成工作。

会话保存在当前设备。内置智能体的网页任务直接在扩展内运行，无需安装额外的桌面软件。可选的连接助手提供本地文件、命令及原生 Codex / Claude 能力；所选引擎仍可能将任务内容发送给云端模型服务。

**当前状态：** `main` 是 v0.6.0 开发源码，[GitHub Releases](https://github.com/wintc23/web-agent-mate/releases) 中的安装包可能落后于源码。体验本文功能时，请从源码构建扩展；需要使用电脑中的文件或命令时，再从同一份源码构建连接助手。已完成验证及尚待真实模型验收的内容见[验收记录](docs/ACCEPTANCE-v0.6.md)。

## 可以做什么

- **理解网页：** 总结文章、解释选中文本、翻译、提取信息，或围绕当前页面继续追问。
- **执行浏览器任务：** 读取页面、导航、点击、填写、选择、滚动和截图，在会话中处理工具授权请求。
- **结合本地工作：** 选择工作目录，让智能体读取、搜索、编辑文件，运行获准的命令，将网页信息整理成文档。
- **切换智能体：** 在同一会话界面选择 Codex、Claude Code 或内置 OrcaRouter 智能体。
- **管理长期会话：** 独立草稿、搜索、改名、分支、删除，以及 JSON 备份导出；关闭再打开后可恢复历史。
- **使用更大工作区：** 将会话打开为独立标签页，同步侧栏与页面的草稿、进度、回复和停止操作。
- **使用原生 Codex 能力：** 点击智能体选项中的 Codex，在同一窗口内切换「运行配置、技能、MCP、历史」。支持模型与推理档位、执行/计划模式、权限设置、运行中追加指令和原生历史导入。具体范围见 [Codex 兼容说明](docs/CODEX-COMPATIBILITY.md)。
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
| 内置智能体 | 默认在扩展内运行工具循环，通过 OrcaRouter 调用模型；本机文件与命令为可选模式 | 在设置中通过浏览器登录 OrcaRouter |

内置智能体的网页任务只需扩展和 OrcaRouter 连接。开启**本机文件与命令**，或选择 Codex / Claude 时才需要安装连接助手。连接助手的安装器和完整 ZIP 包都内置运行环境，用户无需单独安装 Node.js。Codex、Claude 使用各自的认证；只有内置智能体需要连接 OrcaRouter。模型可用性、额度和费用取决于对应服务。

未安装连接助手时可以运行内置智能体的网页任务，以及查看和管理所有会话、草稿。设置页采用左侧纵向导航与右侧内容区，窄侧栏下导航显示图标并提供名称提示。设置分为“模型服务”“本地连接”“通用”和“关于”，分别管理模型连接、本机工具、语言与主题，以及版本与隐私说明。“设置 → 本地连接”提供“下载连接助手”“安装说明”和“重新检测”，选择本机能力而未连接时也会显示入口。详见[连接助手安装说明](docs/BRIDGE-INSTALL.md)。

## 从源码安装

### 1. 准备环境

- Google Chrome 116 或更新版本，启用开发者模式以加载未打包扩展。
- 构建扩展需要 Node.js 20+ 和 npm；CI 使用 Node.js 22。加载构建好的扩展、运行网页任务的用户不需要安装 Node.js。
- 仅构建可选 Bridge 时需要 Rust stable 和 Cargo。Windows 还需 MSVC C++ 构建工具；macOS 需 Xcode Command Line Tools；Linux 需 C 编译器和链接器。
- 根据上表准备所选智能体的 CLI 或账号。

### 2. 构建并加载扩展

```bash
git clone https://github.com/wintc23/web-agent-mate.git
cd web-agent-mate
npm ci
npm run build
```

打开 `chrome://extensions`，启用**开发者模式**，点击**加载已解压的扩展程序**，选择刚生成的 `dist/` 目录，然后将 WebAgentMate 固定到工具栏。

### 3. 构建并安装连接助手（可选）

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

构建脚本会生成连接助手所用的 Node runtime 和 Rust Bridge。安装器将它们复制到当前用户目录，并注册 `ai.webagentmate.bridge` Native Messaging 主机。安装后重启 Chrome 或重新加载扩展。

仓库中的公开 manifest key 将默认扩展 ID 固定为 `lmlkkallnnjijicmfmfdelnamcnhflfg`，无需手动配对。图形安装器在构建时根据 key 生成 ID，fork 修改 key 后需要重新构建安装器。使用开发安装脚本时，可将 `chrome://extensions` 中显示的 ID 作为第一个参数传入；PowerShell 使用 `-ExtensionId`。manifest key 是公开身份信息，不是签名私钥。

### 4. 开始第一段对话

1. 打开普通 HTTP(S) 网页，点击工具栏中的 WebAgentMate 图标。
2. 进入**设置 → 模型服务**，连接 OrcaRouter 后即可运行网页任务。需要本机能力时再检查 Bridge 连接。
3. 打开模型/智能体选择器，选择引擎和模型；涉及本机文件时开启“本机文件与命令”并选择工作目录。
4. 输入“总结当前页面”，根据提示确认工具操作；需要中断时点击停止。
5. 在**会话**中切换历史记录，或将当前会话打开到独立页面。

## 使用发布包安装

网页任务只需加载已发布的扩展包 `webagentmate-extension.zip`。需要使用电脑中的文件或命令时，打开**设置 → 本地连接 → 下载连接助手**，按钮会直接下载匹配扩展版本及当前系统的安装器；旁边的菜单可切换其他平台或 Linux 软件包格式。

| 平台 | 安装器 | 操作 |
| --- | --- | --- |
| macOS Apple Silicon | `webagentmate-bridge-macos-arm64.dmg` | 打开 DMG，双击安装程序，点击安装 |
| macOS Intel | `webagentmate-bridge-macos-x64.dmg` | 打开 DMG，双击安装程序，点击安装 |
| Windows x64 | `webagentmate-bridge-windows-x64.exe` | 打开后按安装向导操作 |
| Ubuntu / Debian x64 | `webagentmate-bridge-linux-x64.deb` | 用系统软件安装器打开并安装 |
| Fedora x64 | `webagentmate-bridge-linux-x64.rpm` | 用系统软件安装器打开并安装 |

连接助手的所有分发包均内置独立的 Node.js 和依赖许可证，不替换已有 Node，也不修改全局 PATH。使用图形安装器时，用户不需要执行命令或单独安装 Node.js。安装完成后返回插件点击**重新检测**，Chrome 会按需启动连接助手。macOS 要求 13.5+；Linux 软件包面向 Ubuntu 22.04+、Debian 12+ 及兼容 glibc 2.35+ 的发行版。

当前源码构建的安装说明默认展示当前系统，可通过标签切换其他平台。macOS 还提供可复制的安装命令，使用完整发布 ZIP 完成安装，详见[命令安装说明](docs/BRIDGE-INSTALL.md#macos)。这项界面改进将随下一次扩展更新发布。

上表中的安装包已于 2026-09-17 公开发布，可直接[下载 v0.6.0](https://github.com/wintc23/web-agent-mate/releases/tag/v0.6.0)。macOS 安装器未进行 Developer ID 签名和 Apple 公证，Windows 安装器未进行发布者签名，首次打开时系统可能要求确认允许安装。自动更新保留更新清单签名和 SHA-256 校验。开发构建与发布配置见[安装器开发说明](docs/INSTALLER-DEVELOPMENT.md)，用户操作见[安装说明](docs/BRIDGE-INSTALL.md)。

## 会话与长任务

在独立页面中再次点击 Chrome 工具栏里的插件图标，会在新标签页打开当前会话。原页面和任务继续保留。

每个会话独立保存草稿、消息、工具记录、模型与工作目录。搜索支持标题、消息、模型和路径。分支会话会保留原会话；切换引擎、本机工具开关或工作目录也会建立分支，避免混用执行上下文。

JSON 备份包含对话、草稿和工具内容，不包含应用连接设置或原生 session ID。会话操作菜单保留导出，列表不再提供导入备份入口。备份可能包含对话里已有的敏感内容。

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

推送 `v*` 标签会构建扩展、DMG/EXE/DEB/RPM 安装器及开发者 ZIP，并检查 macOS 签名/公证和 Windows 签名后发布。手动触发工作流只生成开发测试包，不发布。

## 常见问题

| 问题 | 处理方式 |
| --- | --- |
| 连接助手未连接或找不到 native host | 重新运行对应系统的安装器，核对扩展与连接助手版本，然后重启 Chrome。 |
| `NODE_20_REQUIRED` | 重新安装匹配版本的完整连接助手包，恢复包内运行环境，无需单独安装 Node.js。 |
| `RUNTIME_BUNDLE_MISSING` 或要求更新 Bridge | 重新安装匹配版本的完整连接助手包。源码维护者需重新构建 runtime、Bridge，再运行源码安装脚本生成完整安装内容。 |
| Codex / Claude 不可用 | 确认 CLI 已安装且可被 Chrome 启动的进程发现，并先在终端完成一次有效的已认证请求。 |
| `CLAUDE_AUTH_REQUIRED` | 在终端运行 `claude auth login` 后重试。 |
| 无法读取 `chrome://` 页面 | 切换到普通 HTTP(S) 页面；浏览器内部页面和文件 URL 不在工具支持范围内。 |
| 关闭侧栏后任务停止 | 在独立会话页面发起后续任务，并保持发起任务的页面打开。 |
| OrcaRouter 提示限流或额度错误 | 按界面提示重试、选择模型、检查连接或账户额度。模型目录可访问不代表具有推理额度。 |

更新源码后，需要重新构建扩展和 Bridge、重新运行安装脚本，再重新加载扩展。图形安装可通过 macOS 安装器的卸载按钮、Windows 设置 → 应用或 Linux 软件管理器卸载；源码安装保留 `scripts/uninstall-native-host-*` 脚本；扩展需在 Chrome 中单独移除。

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
