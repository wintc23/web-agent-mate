import type { SupportedLanguage } from "./locales";

const en = {
  terminal: "Command installation", graphical: "Graphical installation", copy: "Copy installation command", copied: "Command copied", copyFailed: "Could not copy. Open “View command” and copy it manually.", viewCommand: "View command",
  steps: "1. Copy the installation command.\n2. Open **Terminal** on your Mac, paste it and press Return.\n3. When installation finishes, return here and click **Check again**.",
  detail: "The command downloads the complete package from this project's GitHub release, verifies its checksum and installs it for your account. Node.js is included. Your system security settings and existing Node installation stay unchanged."
};
export const bridgeInstallMethods: Record<SupportedLanguage, typeof en> = {
  en,
  zh_CN: {
    terminal: "命令安装", graphical: "图形安装", copy: "复制安装命令", copied: "已复制安装命令", copyFailed: "复制失败，请展开“查看命令”手动复制。", viewCommand: "查看命令",
    steps: "1. 复制安装命令。\n2. 打开 Mac 的**终端**，粘贴并按回车。\n3. 等待安装完成，返回这里点击**重新检测**。",
    detail: "命令会从本项目的 GitHub 发布页下载完整包，校验文件后安装到当前账户。安装包自带 Node.js，保留系统安全设置和已有 Node 环境。"
  },
  zh_TW: {
    terminal: "指令安裝", graphical: "圖形安裝", copy: "複製安裝指令", copied: "已複製安裝指令", copyFailed: "複製失敗，請展開「查看指令」手動複製。", viewCommand: "查看指令",
    steps: "1. 複製安裝指令。\n2. 開啟 Mac 的**終端機**，貼上並按 Return。\n3. 等待安裝完成，返回這裡點選**重新偵測**。",
    detail: "指令會從本專案的 GitHub 發布頁下載完整套件，驗證檔案後安裝至目前帳號。套件內含 Node.js，保留系統安全設定與現有的 Node 環境。"
  },
  ja: {
    terminal: "コマンドでインストール", graphical: "画面でインストール", copy: "インストールコマンドをコピー", copied: "コマンドをコピーしました", copyFailed: "コピーできませんでした。「コマンドを表示」を開いて手動でコピーしてください。", viewCommand: "コマンドを表示",
    steps: "1. インストールコマンドをコピーします。\n2. Mac の**ターミナル**を開き、貼り付けて Return キーを押します。\n3. インストール完了後、ここに戻って**再確認**をクリックします。",
    detail: "このプロジェクトの GitHub リリースから完全なパッケージをダウンロードし、チェックサムを検証して現在のアカウントにインストールします。Node.js は同梱されています。システムのセキュリティ設定と既存の Node 環境は維持されます。"
  },
  de: {
    terminal: "Per Terminal", graphical: "Mit Installationsprogramm", copy: "Installationsbefehl kopieren", copied: "Befehl kopiert", copyFailed: "Kopieren fehlgeschlagen. Öffnen Sie „Befehl anzeigen“ und kopieren Sie ihn manuell.", viewCommand: "Befehl anzeigen",
    steps: "1. Kopieren Sie den Installationsbefehl.\n2. Öffnen Sie **Terminal** auf Ihrem Mac, fügen Sie ihn ein und drücken Sie Return.\n3. Klicken Sie nach der Installation hier auf **Erneut prüfen**.",
    detail: "Der Befehl lädt das vollständige Paket aus dem GitHub-Release dieses Projekts, prüft die Prüfsumme und installiert es für Ihr Benutzerkonto. Node.js ist enthalten. Ihre Sicherheitseinstellungen und die vorhandene Node-Installation bleiben erhalten."
  },
  pt_BR: {
    terminal: "Pelo terminal", graphical: "Pelo instalador", copy: "Copiar comando de instalação", copied: "Comando copiado", copyFailed: "Não foi possível copiar. Abra “Ver comando” e copie manualmente.", viewCommand: "Ver comando",
    steps: "1. Copie o comando de instalação.\n2. Abra o **Terminal** do Mac, cole o comando e pressione Return.\n3. Ao concluir, volte aqui e clique em **Verificar novamente**.",
    detail: "O comando baixa o pacote completo da versão deste projeto no GitHub, verifica a soma de verificação e instala na sua conta. O Node.js está incluído. As configurações de segurança e a instalação existente do Node são preservadas."
  }
};
