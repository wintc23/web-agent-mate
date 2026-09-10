# Install Connector / 安装连接助手

Connector installers include the runtime. You do not need a terminal or a separate Node.js installation. The built-in browser agent does not need Connector.

连接助手 安装器已包含所需运行环境，无需执行命令或单独安装 Node.js。内置智能体的网页任务无需 连接助手。

## Download / 下载

Open **Settings → Local connection → Download Connector**. The button downloads an installer matching your extension version and operating system. Use the adjacent menu to choose another platform or Linux package format. Open the completed download from Chrome's downloads list.

打开**设置 → 本地连接 → 下载 连接助手**，按钮会直接下载匹配扩展版本和系统的安装器。旁边的菜单可选择其他平台或 Linux 软件包格式。下载完成后，从 Chrome 下载列表打开文件。

If a compatible installer has not been published, the extension says so and keeps your conversations and drafts. Development builds are not public releases.

若匹配版本尚未发布，插件会明确提示，会话和草稿会保留。开发测试包与正式发布包是分开的。

## macOS

1. Open the `.dmg`, then double-click **WebAgentMate Connector**.
2. Click **Install / Update**. Installation applies to your Mac account.
3. Return to the extension and click **Check again**. You can eject the disk image afterward.

打开 `.dmg`，双击 **WebAgentMate Connector**，点击**安装 / 更新**。完成后返回插件点击**重新检测**，即可推出磁盘映像。支持 Intel 和 Apple Silicon，要求 macOS 13.5 或更新版本。

## Windows

1. Open the `.exe` and follow the installation wizard.
2. Return to the extension and click **Check again**.

打开 `.exe`，按照安装向导完成安装，然后回到插件点击**重新检测**。安装到当前 Windows 账户，支持 Windows x64。

## Linux

1. Open the `.deb` (Ubuntu/Debian) or `.rpm` (Fedora) with your system's software installer.
2. Click **Install** and complete the system authorization prompt.
3. Return to the extension and click **Check again**.

使用系统软件安装器打开 `.deb`（Ubuntu/Debian）或 `.rpm`（Fedora），点击**安装**并完成系统授权，再回到插件点击**重新检测**。支持 Linux x64；Ubuntu 22.04+、Debian 12+，其他发行版需要 glibc 2.35 或更新版本及相应的软件包管理器。

## Start and update / 启动与更新

Chrome starts Connector automatically when the extension connects. If it is still unavailable after installation, restart Chrome and check again. To update, download and open the new installer. Codex and Claude Code still need their own applications and authentication.

插件连接时，Chrome 会自动启动 连接助手。安装后仍无法连接时，请重启 Chrome 并重新检测。更新时下载并打开新版安装器即可。Codex / Claude Code 仍需各自的应用及登录。

## Uninstall / 卸载

- **macOS:** reopen the Connector installer and choose **Uninstall**.
- **Windows:** remove **WebAgentMate Connector** in **Settings → Apps**.
- **Linux:** remove **WebAgentMate Connector** in your software manager.

macOS 重新打开安装器选择**卸载**；Windows 在**设置 → 应用**中卸载；Linux 使用软件管理器移除。卸载 连接助手 会保留会话数据和已创建的文件。扩展需在 Chrome 中单独移除。

Developer build, signing and packaging instructions: [Installer development](../docs/INSTALLER-DEVELOPMENT.md).
