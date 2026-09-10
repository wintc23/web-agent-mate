import AppKit

let chinese = Locale.preferredLanguages.first?.hasPrefix("zh") == true
func text(_ en: String, _ zh: String) -> String { chinese ? zh : en }
let app = NSApplication.shared
app.setActivationPolicy(.regular)
if let iconURL = Bundle.main.url(forResource: "BridgeIcon", withExtension: "png") {
    app.applicationIconImage = NSImage(contentsOf: iconURL)
}
app.activate(ignoringOtherApps: true)

func alert(_ title: String, _ detail: String) -> NSAlert {
    let result = NSAlert()
    result.messageText = title
    result.informativeText = detail
    result.icon = app.applicationIconImage
    return result
}

let welcome = alert(text("WebAgentMate Connector", "WebAgentMate 连接助手"), text(
    "Install browser access to local files, commands, Codex and Claude Code for your Mac account. Everything needed is included. Chrome starts Connector when needed.",
    "为当前 Mac 账户安装本机文件、命令及 Codex / Claude Code 的浏览器连接。安装完成后，Chrome 会在需要时自动连接。"))
welcome.addButton(withTitle: text("Install / Update", "安装 / 更新"))
welcome.addButton(withTitle: text("Uninstall", "卸载"))
welcome.addButton(withTitle: text("Quit", "退出"))
let choice = welcome.runModal()
if choice == .alertThirdButtonReturn { exit(0) }
let action = choice == .alertSecondButtonReturn ? "uninstall" : "install"
if action == "uninstall" {
    let confirm = alert(text("Remove Connector?", "卸载连接助手？"), text("Conversation data and created files will be preserved.", "会话数据和已创建的文件会保留。"))
    confirm.addButton(withTitle: text("Uninstall", "卸载"))
    confirm.addButton(withTitle: text("Cancel", "取消"))
    if confirm.runModal() != .alertFirstButtonReturn { exit(0) }
}
guard let source = Bundle.main.resourceURL?.appendingPathComponent("bridge") else { exit(1) }
let progress = alert(text("Working…", "正在处理…"), text("Please keep this window open until installation finishes.", "请保持此窗口打开，等待操作完成。"))
progress.addButton(withTitle: text("Working…", "正在处理…")).isEnabled = false
let spinner = NSProgressIndicator(frame: NSRect(x: 0, y: 0, width: 240, height: 18))
spinner.style = .bar
spinner.isIndeterminate = true
spinner.startAnimation(nil)
progress.accessoryView = spinner
var failure: String?
DispatchQueue.global(qos: .userInitiated).async {
    do {
        let process = Process()
        process.executableURL = source.appendingPathComponent("runtime/node/bin/node")
        process.arguments = [source.appendingPathComponent("setup.cjs").path, action, source.path]
        let errors = Pipe()
        process.standardError = errors
        process.standardOutput = FileHandle.nullDevice
        try process.run()
        let data = errors.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        if process.terminationStatus != 0 { failure = String(data: data, encoding: .utf8) ?? "Installation failed" }
    } catch { failure = error.localizedDescription }
    DispatchQueue.main.async { NSApp.abortModal(); progress.window.orderOut(nil) }
}
progress.runModal()
let result = failure.map { alert(text("Could not finish", "操作未完成"), $0) } ?? alert(
    action == "install" ? text("Connector is installed", "连接助手已安装") : text("Connector is uninstalled", "连接助手已卸载"),
    action == "install" ? text("Return to WebAgentMate Settings → Local connection and click Check again. You can eject this disk image. If Chrome cannot connect, restart Chrome.", "返回 WebAgentMate 设置 → 本地连接，点击重新检测。现在可以推出此磁盘映像。若 Chrome 仍无法连接，请重启 Chrome。") : text("Your conversations and files are preserved.", "你的会话和文件已保留。"))
result.addButton(withTitle: text("Done", "完成"))
result.runModal()
