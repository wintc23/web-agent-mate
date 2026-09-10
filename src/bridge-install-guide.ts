import type { SupportedLanguage } from "./locales";

export const bridgeInstallGuides: Record<SupportedLanguage, string> = {
  en: `Connector lets WebAgentMate use files and commands on your computer and connect to Codex or Claude Code. Browser tasks do not need it. Everything needed is included in the installer.

## Download

Open **Settings → Local connection → Download Connector**. The button downloads the installer matching your system and extension version. Use the adjacent menu to choose another platform or Linux package format. Open the completed file from Chrome downloads.

If a matching installer has not been published, the extension says so. Browser tasks remain available.

## macOS

1. Open the **.dmg**, then double-click **WebAgentMate Connector**.
2. Click **Install / Update**. Installation applies to your Mac account.
3. Return to the extension and click **Check again**, then eject the disk image.

Choose Apple Silicon or Intel to match your Mac. Requires macOS 13.5 or later.

## Windows

Open the **.exe** and follow the installation wizard. Return to the extension and click **Check again**. Installation applies to your Windows account. Supports Windows x64.

## Linux

Open the **.deb** (Ubuntu/Debian) or **.rpm** (Fedora) with your system's software installer. Click **Install** and complete the system authorization prompt. Return to the extension and click **Check again**.

Supports Linux x64: Ubuntu 22.04+, Debian 12+, or compatible systems with glibc 2.35+ and the appropriate package manager.

## Start, update and remove

Chrome starts Connector when needed. If it cannot connect after installation, restart Chrome and check again. To update, download and open the new installer. Codex and Claude Code still need their own applications and sign-in.

To remove Connector, reopen the Mac installer and choose **Uninstall**, use **Windows Settings → Apps**, or use your Linux software manager. Conversations and created files are preserved. Remove the extension separately in Chrome.`,
  zh_CN: `连接助手让 WebAgentMate 使用电脑中的文件、运行命令，并连接 Codex 或 Claude Code。仅处理网页无需安装。打开安装器即可完成配置。

## 下载

打开**设置 → 本地连接 → 下载连接助手**，直接下载匹配当前系统和扩展版本的安装器。旁边的菜单可选择其他平台或 Linux 软件包格式。下载完成后，从 Chrome 下载列表打开文件。

若匹配版本尚未发布，插件会明确提示；你仍可继续使用网页任务。

## macOS

1. 打开 **.dmg**，双击 **WebAgentMate Connector**。
2. 点击**安装 / 更新**，安装到当前 Mac 账户。
3. 返回插件点击**重新检测**，然后推出磁盘映像。

根据 Mac 处理器选择 Apple Silicon 或 Intel。需要 macOS 13.5 或更新版本。

## Windows

打开 **.exe**，按照安装向导完成安装，再返回插件点击**重新检测**。安装到当前 Windows 账户，支持 Windows x64。

## Linux

使用系统软件安装器打开 **.deb**（Ubuntu/Debian）或 **.rpm**（Fedora），点击**安装**并完成系统授权，再返回插件点击**重新检测**。

支持 Linux x64：Ubuntu 22.04+、Debian 12+，或具有 glibc 2.35+ 及相应软件包管理器的兼容系统。

## 启动、更新与卸载

Chrome 会在需要时自动启动连接助手。安装后仍无法连接时，请重启 Chrome 并重新检测。更新时下载并打开新版安装器即可。Codex / Claude Code 仍需各自的应用及登录。

卸载时，macOS 重新打开安装器选择**卸载**，Windows 使用**设置 → 应用**，Linux 使用软件管理器。会话和已创建的文件会保留。扩展需在 Chrome 中单独移除。`,
  zh_TW: `連線助手讓 WebAgentMate 使用電腦中的檔案、執行指令，並連接 Codex 或 Claude Code。僅處理網頁不需安裝。開啟安裝程式即可完成設定。

## 下載

開啟**設定 → 本機連線 → 下載連線助手**，直接下載符合目前系統與擴充功能版本的安裝程式。旁邊的選單可選擇其他平台或 Linux 套件格式。下載完成後，從 Chrome 下載清單開啟檔案。

若對應版本尚未發布，擴充功能會明確提示；你仍可繼續使用網頁任務。

## macOS

1. 開啟 **.dmg**，按兩下 **WebAgentMate Connector**。
2. 點選**安裝 / 更新**，安裝至目前的 Mac 帳號。
3. 返回擴充功能點選**重新偵測**，然後退出磁碟映像檔。

依照 Mac 處理器選擇 Apple Silicon 或 Intel。需要 macOS 13.5 或更新版本。

## Windows

開啟 **.exe**，依照安裝精靈完成安裝，再返回擴充功能點選**重新偵測**。安裝至目前的 Windows 帳號，支援 Windows x64。

## Linux

使用系統軟體安裝程式開啟 **.deb**（Ubuntu/Debian）或 **.rpm**（Fedora），點選**安裝**並完成系統授權，再返回擴充功能點選**重新偵測**。

支援 Linux x64：Ubuntu 22.04+、Debian 12+，或具備 glibc 2.35+ 與相應套件管理員的相容系統。

## 啟動、更新與解除安裝

Chrome 會在需要時自動啟動連線助手。安裝後仍無法連線時，請重新啟動 Chrome 並重新偵測。更新時下載並開啟新版安裝程式即可。Codex / Claude Code 仍需要各自的應用程式及登入。

移除連線助手時，macOS 重新開啟安裝程式選擇**卸載**，Windows 使用**設定 → 應用程式**，Linux 使用軟體管理員。對話與已建立的檔案會保留。擴充功能需在 Chrome 中另外移除。`,
  ja: `接続アシスタントを使うと、WebAgentMate からパソコンのファイルやコマンド、Codex、Claude Code を利用できます。ブラウザーのタスクには不要です。必要なものはインストーラーに含まれています。

## ダウンロード

**設定 → ローカル接続 → 接続アシスタントをダウンロード**を開きます。現在の OS と拡張機能のバージョンに合うインストーラーを直接ダウンロードします。隣のメニューで別のプラットフォームや Linux のパッケージ形式を選べます。完了したファイルを Chrome のダウンロード一覧から開いてください。

対応するインストーラーが未公開の場合は、その旨が表示されます。ブラウザーのタスクは引き続き利用できます。

## macOS

1. **.dmg** を開き、**WebAgentMate Connector** をダブルクリックします。
2. **Install / Update**（インストール／更新）をクリックします。現在の Mac アカウントにインストールされます。
3. 拡張機能に戻って**再確認**をクリックし、ディスクイメージを取り出します。

Mac のプロセッサーに合わせて Apple Silicon または Intel を選んでください。macOS 13.5 以降が必要です。

## Windows

**.exe** を開き、インストールウィザードに従います。完了後、拡張機能に戻って**再確認**をクリックします。現在の Windows アカウントにインストールされます。Windows x64 に対応しています。

## Linux

**.deb**（Ubuntu/Debian）または **.rpm**（Fedora）をシステムのソフトウェアインストーラーで開きます。**インストール**をクリックしてシステムの認証を完了し、拡張機能に戻って**再確認**をクリックします。

Linux x64 に対応しています。Ubuntu 22.04 以降、Debian 12 以降、または glibc 2.35 以降と対応パッケージマネージャーを備えた互換システムが必要です。

## 起動・更新・削除

Chrome が必要に応じて 接続アシスタント を起動します。インストール後に接続できない場合は Chrome を再起動して再確認してください。更新するには新しいインストーラーをダウンロードして開きます。Codex と Claude Code には、それぞれのアプリケーションとログインが必要です。

削除するには Mac のインストーラーで **Uninstall**（アンインストール）、Windows の**設定 → アプリ**、または Linux のソフトウェアマネージャーを使います。会話と作成したファイルは保持されます。拡張機能は Chrome で別途削除してください。`,
  de: `Mit dem Verbindungshelfer kann WebAgentMate lokale Dateien und Befehle nutzen sowie Codex oder Claude Code verbinden. Für Browser-Aufgaben ist er nicht nötig. Alles Erforderliche ist im Installationspaket enthalten.

## Herunterladen

Öffnen Sie **Einstellungen → Lokale Verbindung → Verbindungshelfer herunterladen**. Die Schaltfläche lädt das Installationspaket für Ihr System und Ihre Erweiterungsversion direkt herunter. Im Menü daneben können Sie eine andere Plattform oder ein Linux-Paketformat wählen. Öffnen Sie die fertige Datei über die Chrome-Downloads.

Ist noch kein passendes Paket veröffentlicht, zeigt die Erweiterung einen Hinweis. Browser-Aufgaben bleiben verfügbar.

## macOS

1. Öffnen Sie die **.dmg** und doppelklicken Sie auf **WebAgentMate Connector**.
2. Klicken Sie auf **Install / Update** (Installieren / Aktualisieren). Die Installation gilt für Ihr Mac-Benutzerkonto.
3. Kehren Sie zur Erweiterung zurück, klicken Sie auf **Erneut prüfen** und werfen Sie das Image aus.

Wählen Sie passend zu Ihrem Mac Apple Silicon oder Intel. Voraussetzung ist macOS 13.5 oder neuer.

## Windows

Öffnen Sie die **.exe** und folgen Sie dem Installationsassistenten. Kehren Sie danach zur Erweiterung zurück und klicken Sie auf **Erneut prüfen**. Die Installation gilt für Ihr Windows-Benutzerkonto. Unterstützt wird Windows x64.

## Linux

Öffnen Sie die **.deb** (Ubuntu/Debian) oder **.rpm** (Fedora) mit der Softwareverwaltung Ihres Systems. Klicken Sie auf **Installieren** und bestätigen Sie die Systemautorisierung. Kehren Sie zur Erweiterung zurück und klicken Sie auf **Erneut prüfen**.

Unterstützt wird Linux x64: Ubuntu 22.04+, Debian 12+ oder kompatible Systeme mit glibc 2.35+ und passender Paketverwaltung.

## Starten, aktualisieren und entfernen

Chrome startet den Verbindungshelfer bei Bedarf. Falls nach der Installation keine Verbindung möglich ist, starten Sie Chrome neu und prüfen Sie erneut. Für Updates laden Sie das neue Installationspaket herunter und öffnen es. Codex und Claude Code benötigen weiterhin ihre eigenen Anwendungen und Anmeldungen.

Zum Entfernen wählen Sie im Mac-Installationsprogramm **Uninstall** (Deinstallieren), öffnen unter Windows **Einstellungen → Apps** oder verwenden die Linux-Softwareverwaltung. Gespräche und erstellte Dateien bleiben erhalten. Die Erweiterung entfernen Sie separat in Chrome.`,
  pt_BR: `O assistente de conexão permite que o WebAgentMate use arquivos e comandos do computador e conecte Codex ou Claude Code. Tarefas no navegador não precisam dele. O instalador inclui tudo o que é necessário.

## Download

Abra **Configurações → Conexão local → Baixar assistente de conexão**. O botão baixa diretamente o instalador compatível com seu sistema e a versão da extensão. No menu ao lado, escolha outra plataforma ou formato de pacote Linux. Após concluir o download, abra o arquivo na lista de downloads do Chrome.

Se ainda não houver um instalador compatível publicado, a extensão avisará. As tarefas no navegador continuam disponíveis.

## macOS

1. Abra o **.dmg** e clique duas vezes em **WebAgentMate Connector**.
2. Clique em **Install / Update** (Instalar / Atualizar). A instalação é feita para sua conta do Mac.
3. Volte à extensão, clique em **Verificar novamente** e ejete a imagem de disco.

Escolha Apple Silicon ou Intel conforme o processador do Mac. Requer macOS 13.5 ou posterior.

## Windows

Abra o **.exe** e siga o assistente de instalação. Depois, volte à extensão e clique em **Verificar novamente**. A instalação é feita para sua conta do Windows. Compatível com Windows x64.

## Linux

Abra o **.deb** (Ubuntu/Debian) ou **.rpm** (Fedora) com o instalador de software do sistema. Clique em **Instalar** e conclua a autorização do sistema. Volte à extensão e clique em **Verificar novamente**.

Compatível com Linux x64: Ubuntu 22.04+, Debian 12+ ou sistemas compatíveis com glibc 2.35+ e o gerenciador de pacotes adequado.

## Iniciar, atualizar e remover

O Chrome inicia o assistente de conexão quando necessário. Se não conseguir conectar após a instalação, reinicie o Chrome e verifique novamente. Para atualizar, baixe e abra o novo instalador. Codex e Claude Code ainda precisam de seus próprios aplicativos e autenticação.

Para remover, escolha **Uninstall** (Desinstalar) no instalador do Mac, use **Configurações → Aplicativos** no Windows ou o gerenciador de software do Linux. As conversas e os arquivos criados serão preservados. Remova a extensão separadamente no Chrome.`
};
