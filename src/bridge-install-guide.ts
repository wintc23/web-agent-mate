import type { SupportedLanguage } from "./locales";
import type { BridgePlatform } from "./agent/bridge-download";

type BridgeInstallGuide = {
  download: string;
  platforms: Record<BridgePlatform, string>;
  maintenance: string;
  uninstall: Record<BridgePlatform, string>;
};

export const bridgeInstallGuides: Record<SupportedLanguage, BridgeInstallGuide> = {
  en: {
    download: `Download the installer below, then open it from Chrome downloads. Use the tabs to view the instructions for another system.`,
    platforms: {
      macos: `1. Open the **.dmg**, then double-click **WebAgentMate Connector**.
2. Click **Install / Update**. Installation applies to your Mac account.
3. Return to the extension and click **Check again**, then eject the disk image.

Choose Apple Silicon or Intel to match your Mac. Requires macOS 13.5 or later.`,
      windows: `Open the **.exe** and follow the installation wizard. Return to the extension and click **Check again**. Installation applies to your Windows account. Supports Windows x64.`,
      linux: `Open the **.deb** (Ubuntu/Debian) or **.rpm** (Fedora) with your system's software installer. Click **Install** and complete the system authorization prompt. Return to the extension and click **Check again**.

Supports Linux x64: Ubuntu 22.04+, Debian 12+, or compatible systems with glibc 2.35+ and the appropriate package manager.`,
    },
    maintenance: `## Start, update and remove

Chrome starts Connector when needed. If it cannot connect after installation, restart Chrome and check again. The new Connector updates automatically after local tasks finish and restores the previous version if startup checks fail. Pause or check updates in **Settings → Local connection → Automatic Connector updates**. Older installations need a one-time installation of the new Connector. Codex and Claude Code still need their own applications and sign-in.`,
    uninstall: {
      macos: `To remove Connector, reopen the Mac installer and choose **Uninstall**. Conversations and created files are preserved. Remove the extension separately in Chrome.`,
      windows: `To remove Connector, use **Windows Settings → Apps**. Conversations and created files are preserved. Remove the extension separately in Chrome.`,
      linux: `To remove Connector, use your Linux software manager. Conversations and created files are preserved. Remove the extension separately in Chrome.`,
    }
  },
  zh_CN: {
    download: `点击下方按钮下载安装器，下载完成后从 Chrome 下载列表打开。可通过上方标签切换其他系统的安装方式。`,
    platforms: {
      macos: `1. 打开 **.dmg**，双击 **WebAgentMate Connector**。
2. 点击**安装 / 更新**，安装到当前 Mac 账户。
3. 返回插件点击**重新检测**，然后推出磁盘映像。

根据 Mac 处理器选择 Apple Silicon 或 Intel。需要 macOS 13.5 或更新版本。`,
      windows: `打开 **.exe**，按照安装向导完成安装，再返回插件点击**重新检测**。安装到当前 Windows 账户，支持 Windows x64。`,
      linux: `使用系统软件安装器打开 **.deb**（Ubuntu/Debian）或 **.rpm**（Fedora），点击**安装**并完成系统授权，再返回插件点击**重新检测**。

支持 Linux x64：Ubuntu 22.04+、Debian 12+，或具有 glibc 2.35+ 及相应软件包管理器的兼容系统。`,
    },
    maintenance: `## 启动、更新与卸载

Chrome 会在需要时自动启动连接助手。安装后仍无法连接时，请重启 Chrome 并重新检测。新版连接助手会在本地任务结束后自动更新，启动检查失败时恢复旧版。可在**设置 → 本地连接 → 自动更新连接助手**中暂停或检查更新。旧版需先安装一次新版。Codex / Claude Code 仍需各自的应用及登录。`,
    uninstall: {
      macos: `卸载时，重新打开 Mac 安装器选择**卸载**。 会话和已创建的文件会保留。扩展需在 Chrome 中单独移除。`,
      windows: `卸载时，使用 **Windows 设置 → 应用**。 会话和已创建的文件会保留。扩展需在 Chrome 中单独移除。`,
      linux: `卸载时，使用 Linux 软件管理器。 会话和已创建的文件会保留。扩展需在 Chrome 中单独移除。`,
    }
  },
  zh_TW: {
    download: `點選下方按鈕下載安裝程式，下載完成後從 Chrome 下載清單開啟。可透過上方分頁切換其他系統的安裝方式。`,
    platforms: {
      macos: `1. 開啟 **.dmg**，按兩下 **WebAgentMate Connector**。
2. 點選**安裝 / 更新**，安裝至目前的 Mac 帳號。
3. 返回擴充功能點選**重新偵測**，然後退出磁碟映像檔。

依照 Mac 處理器選擇 Apple Silicon 或 Intel。需要 macOS 13.5 或更新版本。`,
      windows: `開啟 **.exe**，依照安裝精靈完成安裝，再返回擴充功能點選**重新偵測**。安裝至目前的 Windows 帳號，支援 Windows x64。`,
      linux: `使用系統軟體安裝程式開啟 **.deb**（Ubuntu/Debian）或 **.rpm**（Fedora），點選**安裝**並完成系統授權，再返回擴充功能點選**重新偵測**。

支援 Linux x64：Ubuntu 22.04+、Debian 12+，或具備 glibc 2.35+ 與相應套件管理員的相容系統。`,
    },
    maintenance: `## 啟動、更新與解除安裝

Chrome 會在需要時自動啟動連線助手。安裝後仍無法連線時，請重新啟動 Chrome 並重新偵測。新版連線助手會在本機任務結束後自動更新，啟動檢查失敗時還原舊版。可在**設定 → 本機連線 → 自動更新連線助手**中暫停或檢查更新。舊版需先安裝一次新版。Codex / Claude Code 仍需要各自的應用程式及登入。`,
    uninstall: {
      macos: `移除連線助手時，重新開啟 Mac 安裝程式選擇**卸載**。 對話與已建立的檔案會保留。擴充功能需在 Chrome 中另外移除。`,
      windows: `移除連線助手時，使用 **Windows 設定 → 應用程式**。 對話與已建立的檔案會保留。擴充功能需在 Chrome 中另外移除。`,
      linux: `移除連線助手時，使用 Linux 軟體管理員。 對話與已建立的檔案會保留。擴充功能需在 Chrome 中另外移除。`,
    }
  },
  ja: {
    download: `下のボタンからインストーラーをダウンロードし、Chrome のダウンロード一覧から開いてください。上のタブで別の OS の手順に切り替えられます。`,
    platforms: {
      macos: `1. **.dmg** を開き、**WebAgentMate Connector** をダブルクリックします。
2. **Install / Update**（インストール／更新）をクリックします。現在の Mac アカウントにインストールされます。
3. 拡張機能に戻って**再確認**をクリックし、ディスクイメージを取り出します。

Mac のプロセッサーに合わせて Apple Silicon または Intel を選んでください。macOS 13.5 以降が必要です。`,
      windows: `**.exe** を開き、インストールウィザードに従います。完了後、拡張機能に戻って**再確認**をクリックします。現在の Windows アカウントにインストールされます。Windows x64 に対応しています。`,
      linux: `**.deb**（Ubuntu/Debian）または **.rpm**（Fedora）をシステムのソフトウェアインストーラーで開きます。**インストール**をクリックしてシステムの認証を完了し、拡張機能に戻って**再確認**をクリックします。

Linux x64 に対応しています。Ubuntu 22.04 以降、Debian 12 以降、または glibc 2.35 以降と対応パッケージマネージャーを備えた互換システムが必要です。`,
    },
    maintenance: `## 起動・更新・削除

Chrome が必要に応じて 接続アシスタント を起動します。インストール後に接続できない場合は Chrome を再起動して再確認してください。新しいコネクターはローカルタスクの終了後に自動更新し、起動確認に失敗した場合は以前のバージョンに戻します。ローカル接続の設定で更新の一時停止や確認ができます。以前のコネクターは最初に一度、新しいインストーラーで更新してください。Codex と Claude Code には、それぞれのアプリケーションとログインが必要です。`,
    uninstall: {
      macos: `削除するには Mac のインストーラーで **Uninstall**（アンインストール）を選んでください。 会話と作成したファイルは保持されます。拡張機能は Chrome で別途削除してください。`,
      windows: `削除するには **Windows の設定 → アプリ**を開いてください。 会話と作成したファイルは保持されます。拡張機能は Chrome で別途削除してください。`,
      linux: `削除するには Linux のソフトウェアマネージャーを使ってください。 会話と作成したファイルは保持されます。拡張機能は Chrome で別途削除してください。`,
    }
  },
  de: {
    download: `Laden Sie das Installationspaket über die Schaltfläche unten herunter und öffnen Sie es über die Chrome-Downloads. Über die Tabs können Sie die Anleitung für ein anderes System wählen.`,
    platforms: {
      macos: `1. Öffnen Sie die **.dmg** und doppelklicken Sie auf **WebAgentMate Connector**.
2. Klicken Sie auf **Install / Update** (Installieren / Aktualisieren). Die Installation gilt für Ihr Mac-Benutzerkonto.
3. Kehren Sie zur Erweiterung zurück, klicken Sie auf **Erneut prüfen** und werfen Sie das Image aus.

Wählen Sie passend zu Ihrem Mac Apple Silicon oder Intel. Voraussetzung ist macOS 13.5 oder neuer.`,
      windows: `Öffnen Sie die **.exe** und folgen Sie dem Installationsassistenten. Kehren Sie danach zur Erweiterung zurück und klicken Sie auf **Erneut prüfen**. Die Installation gilt für Ihr Windows-Benutzerkonto. Unterstützt wird Windows x64.`,
      linux: `Öffnen Sie die **.deb** (Ubuntu/Debian) oder **.rpm** (Fedora) mit der Softwareverwaltung Ihres Systems. Klicken Sie auf **Installieren** und bestätigen Sie die Systemautorisierung. Kehren Sie zur Erweiterung zurück und klicken Sie auf **Erneut prüfen**.

Unterstützt wird Linux x64: Ubuntu 22.04+, Debian 12+ oder kompatible Systeme mit glibc 2.35+ und passender Paketverwaltung.`,
    },
    maintenance: `## Starten, aktualisieren und entfernen

Chrome startet den Verbindungshelfer bei Bedarf. Falls nach der Installation keine Verbindung möglich ist, starten Sie Chrome neu und prüfen Sie erneut. Der neue Connector aktualisiert sich nach Abschluss lokaler Aufgaben automatisch und stellt bei fehlgeschlagenen Startprüfungen die vorherige Version wieder her. Unter Lokale Verbindung können Sie Updates pausieren oder prüfen. Ältere Installationen müssen einmal mit dem neuen Installer aktualisiert werden. Codex und Claude Code benötigen weiterhin ihre eigenen Anwendungen und Anmeldungen.`,
    uninstall: {
      macos: `Zum Entfernen wählen Sie im Mac-Installationsprogramm **Uninstall** (Deinstallieren). Gespräche und erstellte Dateien bleiben erhalten. Die Erweiterung entfernen Sie separat in Chrome.`,
      windows: `Zum Entfernen öffnen Sie **Windows-Einstellungen → Apps**. Gespräche und erstellte Dateien bleiben erhalten. Die Erweiterung entfernen Sie separat in Chrome.`,
      linux: `Zum Entfernen verwenden Sie die Linux-Softwareverwaltung. Gespräche und erstellte Dateien bleiben erhalten. Die Erweiterung entfernen Sie separat in Chrome.`,
    }
  },
  pt_BR: {
    download: `Baixe o instalador pelo botão abaixo e abra o arquivo na lista de downloads do Chrome. Use as abas para ver as instruções de outro sistema.`,
    platforms: {
      macos: `1. Abra o **.dmg** e clique duas vezes em **WebAgentMate Connector**.
2. Clique em **Install / Update** (Instalar / Atualizar). A instalação é feita para sua conta do Mac.
3. Volte à extensão, clique em **Verificar novamente** e ejete a imagem de disco.

Escolha Apple Silicon ou Intel conforme o processador do Mac. Requer macOS 13.5 ou posterior.`,
      windows: `Abra o **.exe** e siga o assistente de instalação. Depois, volte à extensão e clique em **Verificar novamente**. A instalação é feita para sua conta do Windows. Compatível com Windows x64.`,
      linux: `Abra o **.deb** (Ubuntu/Debian) ou **.rpm** (Fedora) com o instalador de software do sistema. Clique em **Instalar** e conclua a autorização do sistema. Volte à extensão e clique em **Verificar novamente**.

Compatível com Linux x64: Ubuntu 22.04+, Debian 12+ ou sistemas compatíveis com glibc 2.35+ e o gerenciador de pacotes adequado.`,
    },
    maintenance: `## Iniciar, atualizar e remover

O Chrome inicia o assistente de conexão quando necessário. Se não conseguir conectar após a instalação, reinicie o Chrome e verifique novamente. O novo Connector se atualiza após as tarefas locais terminarem e restaura a versão anterior se a verificação de inicialização falhar. Pause ou verifique atualizações nas configurações de Conexão local. Instalações antigas precisam instalar o novo Connector uma vez. Codex e Claude Code ainda precisam de seus próprios aplicativos e autenticação.`,
    uninstall: {
      macos: `Para remover, escolha **Uninstall** (Desinstalar) no instalador do Mac. As conversas e os arquivos criados serão preservados. Remova a extensão separadamente no Chrome.`,
      windows: `Para remover, use **Configurações do Windows → Aplicativos**. As conversas e os arquivos criados serão preservados. Remova a extensão separadamente no Chrome.`,
      linux: `Para remover, use o gerenciador de software do Linux. As conversas e os arquivos criados serão preservados. Remova a extensão separadamente no Chrome.`,
    }
  },
};
