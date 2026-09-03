export type SupportedLanguage = "en" | "zh_CN" | "zh_TW" | "pt_BR" | "ja" | "de";
export type LanguagePreference = "auto" | SupportedLanguage;

const en = {
  connectionExperiment: "Local connection", modelService: "Model service", checking: "Checking",
  readingStatus: "Reading local connection status…", connectOrca: "Sign in with OrcaRouter",
  verify: "Verify connection", disconnect: "Disconnect", privacyTitle: "Local-first privacy",
  privacyCopy: "The authorization key is kept in Chrome extension storage restricted to trusted extension contexts. It is not sent to WebAgentMate servers or persisted by Bridge. You can revoke it from OrcaRouter Authorized Apps.",
  developerInfo: "Developer information", callbackUrl: "Callback URL", authorizationProtocol: "Authorization protocol",
  openingOrca: "Opening OrcaRouter…", disconnecting: "Disconnecting…", connected: "Connected",
  notConnected: "Not connected", orcaConnected: "OrcaRouter is connected.", keyDeleted: "The local key was deleted.",
  readingModels: "Reading available models…", modelsFound: "Connection verified. {count} models are available.",
  connectedNoBridge: "OrcaRouter is connected. Bridge is not installed, so local conversations and CLI features are unavailable.",
  disconnectedNoBridge: "You can connect OrcaRouter now. Install Bridge to enable local conversations and CLI tools.",
  connectedWithBridge: "OrcaRouter is connected and Bridge {version} is available.",
  readyWithBridge: "Sign in to OrcaRouter. The key will stay in trusted local extension storage.",
  errorGeneric: "Something went wrong. Please try again.", errorAuthCancelled: "Authorization was cancelled.",
  errorAuthState: "Authorization validation failed. Please try again.", errorAuthCode: "The authorization response did not include a code.",
  errorAuthExchange: "Could not complete OrcaRouter authorization.", errorCredential: "The saved OrcaRouter credential is invalid or expired.",
  errorProvider: "OrcaRouter is temporarily unavailable. Please try again.", language: "Language", languageAuto: "Follow browser"
  , chat: "Chat", connection: "Connections", readPage: "Read current page", pageReady: "Page ready: {title}",
  askPlaceholder: "Ask about this page…", send: "Send", summary: "Summarize", explain: "Explain", keyPoints: "Key points",
  translatePage: "Translate", permissionNeeded: "Allow access to this page to continue.", pageNotReady: "Read the current page first.",
  agentMode: "Agent", agentDescription: "The built-in agent can inspect and operate the current page through the local Bridge.",
  agentPlaceholder: "Describe what you want completed on this page…", runAgent: "Run agent", agentSafety: "Clicks require approval. Passwords, payments, CAPTCHA, deletion and publishing are blocked.",
  approveAction: "Approve page action?", approve: "Approve", cancelAgent: "Stop task"
};

export type TranslationKey = keyof typeof en;
type Dictionary = Record<TranslationKey, string>;

const zhCN: Dictionary = {
  connectionExperiment: "本地连接", modelService: "模型服务", checking: "检查中", readingStatus: "正在读取本地连接状态…",
  connectOrca: "使用 OrcaRouter 登录", verify: "验证连接", disconnect: "断开连接", privacyTitle: "本地优先隐私",
  privacyCopy: "授权 Key 保存在 Chrome 扩展的本地可信存储区，不会发送到 WebAgentMate 服务器，Bridge 也不会持久化它。你可以在 OrcaRouter 的 Authorized Apps 中撤销授权。",
  developerInfo: "开发信息", callbackUrl: "回调地址", authorizationProtocol: "授权协议", openingOrca: "正在打开 OrcaRouter…",
  disconnecting: "正在断开…", connected: "已连接", notConnected: "未连接", orcaConnected: "OrcaRouter 已连接。",
  keyDeleted: "本地 Key 已删除。", readingModels: "正在读取可用模型…", modelsFound: "连接正常，读取到 {count} 个可用模型。",
  connectedNoBridge: "OrcaRouter 已连接；Bridge 尚未安装，本地会话和 CLI 功能不可用。",
  disconnectedNoBridge: "可以先连接 OrcaRouter；安装 Bridge 后可使用本地会话和 CLI。",
  connectedWithBridge: "OrcaRouter 已连接，Bridge {version} 可用。", readyWithBridge: "登录并授权 WebAgentMate；Key 将保存在扩展的本地可信存储区。",
  errorGeneric: "发生错误，请重试。", errorAuthCancelled: "授权已取消。", errorAuthState: "授权状态校验失败，请重试。",
  errorAuthCode: "授权结果中缺少一次性代码。", errorAuthExchange: "无法完成 OrcaRouter 授权。",
  errorCredential: "保存的 OrcaRouter 凭据无效或已过期。", errorProvider: "OrcaRouter 暂时不可用，请稍后重试。",
  language: "语言", languageAuto: "跟随浏览器"
  , chat: "对话", connection: "连接", readPage: "读取当前网页", pageReady: "已读取：{title}",
  askPlaceholder: "针对当前网页提问…", send: "发送", summary: "总结", explain: "解释", keyPoints: "关键要点",
  translatePage: "翻译", permissionNeeded: "请允许访问当前网页后继续。", pageNotReady: "请先读取当前网页。",
  agentMode: "Agent", agentDescription: "内置 Agent 可通过本地 Bridge 观察并操作当前网页。", agentPlaceholder: "描述希望在当前网页完成的事情…",
  runAgent: "运行 Agent", agentSafety: "点击操作需要确认；禁止密码、支付、验证码、删除和发布操作。", approveAction: "批准网页操作？", approve: "批准", cancelAgent: "停止任务"
};

const zhTW: Dictionary = {
  connectionExperiment: "本機連線", modelService: "模型服務", checking: "檢查中", readingStatus: "正在讀取本機連線狀態…",
  connectOrca: "使用 OrcaRouter 登入", verify: "驗證連線", disconnect: "中斷連線", privacyTitle: "本機優先隱私",
  privacyCopy: "授權金鑰保存在 Chrome 擴充功能的本機可信儲存區，不會傳送到 WebAgentMate 伺服器，Bridge 也不會永久保存。你可以在 OrcaRouter Authorized Apps 中撤銷授權。",
  developerInfo: "開發資訊", callbackUrl: "回呼網址", authorizationProtocol: "授權協定", openingOrca: "正在開啟 OrcaRouter…",
  disconnecting: "正在中斷…", connected: "已連線", notConnected: "未連線", orcaConnected: "OrcaRouter 已連線。",
  keyDeleted: "本機金鑰已刪除。", readingModels: "正在讀取可用模型…", modelsFound: "連線正常，可使用 {count} 個模型。",
  connectedNoBridge: "OrcaRouter 已連線；尚未安裝 Bridge，因此無法使用本機對話和 CLI 功能。",
  disconnectedNoBridge: "你可以先連線 OrcaRouter；安裝 Bridge 後即可使用本機對話和 CLI。",
  connectedWithBridge: "OrcaRouter 已連線，Bridge {version} 可用。", readyWithBridge: "登入 OrcaRouter；金鑰將保存在擴充功能的本機可信儲存區。",
  errorGeneric: "發生錯誤，請再試一次。", errorAuthCancelled: "授權已取消。", errorAuthState: "授權狀態驗證失敗，請再試一次。",
  errorAuthCode: "授權回應缺少一次性代碼。", errorAuthExchange: "無法完成 OrcaRouter 授權。",
  errorCredential: "保存的 OrcaRouter 憑證無效或已過期。", errorProvider: "OrcaRouter 暫時無法使用，請稍後再試。",
  language: "語言", languageAuto: "跟隨瀏覽器"
  , chat: "對話", connection: "連線", readPage: "讀取目前網頁", pageReady: "已讀取：{title}",
  askPlaceholder: "針對目前網頁提問…", send: "傳送", summary: "摘要", explain: "解釋", keyPoints: "重點",
  translatePage: "翻譯", permissionNeeded: "請允許存取目前網頁後繼續。", pageNotReady: "請先讀取目前網頁。",
  agentMode: "Agent", agentDescription: "內建 Agent 可透過本機 Bridge 觀察並操作目前網頁。", agentPlaceholder: "描述希望在目前網頁完成的事情…",
  runAgent: "執行 Agent", agentSafety: "點擊操作需要確認；禁止密碼、付款、驗證碼、刪除和發佈操作。", approveAction: "核准網頁操作？", approve: "核准", cancelAgent: "停止任務"
};

const ja: Dictionary = {
  connectionExperiment: "ローカル接続", modelService: "モデルサービス", checking: "確認中", readingStatus: "接続状態を確認しています…",
  connectOrca: "OrcaRouterでサインイン", verify: "接続を確認", disconnect: "接続を解除", privacyTitle: "ローカル優先のプライバシー",
  privacyCopy: "認証キーは、信頼された拡張機能コンテキストに限定されたChromeのローカルストレージに保存されます。WebAgentMateサーバーには送信されず、Bridgeにも永続保存されません。OrcaRouterのAuthorized Appsから取り消せます。",
  developerInfo: "開発情報", callbackUrl: "コールバックURL", authorizationProtocol: "認証プロトコル", openingOrca: "OrcaRouterを開いています…",
  disconnecting: "切断しています…", connected: "接続済み", notConnected: "未接続", orcaConnected: "OrcaRouterに接続しました。",
  keyDeleted: "ローカルキーを削除しました。", readingModels: "利用可能なモデルを取得しています…", modelsFound: "接続を確認しました。{count}個のモデルを利用できます。",
  connectedNoBridge: "OrcaRouterは接続済みです。Bridgeがないため、ローカル会話とCLI機能は利用できません。",
  disconnectedNoBridge: "OrcaRouterには今すぐ接続できます。Bridgeをインストールするとローカル会話とCLIを利用できます。",
  connectedWithBridge: "OrcaRouterに接続済みで、Bridge {version}を利用できます。", readyWithBridge: "OrcaRouterにサインインしてください。キーは拡張機能の信頼済みローカルストレージに保存されます。",
  errorGeneric: "エラーが発生しました。もう一度お試しください。", errorAuthCancelled: "認証がキャンセルされました。", errorAuthState: "認証の検証に失敗しました。",
  errorAuthCode: "認証応答にコードがありません。", errorAuthExchange: "OrcaRouter認証を完了できませんでした。",
  errorCredential: "保存されたOrcaRouter認証情報が無効か期限切れです。", errorProvider: "OrcaRouterは一時的に利用できません。",
  language: "言語", languageAuto: "ブラウザに合わせる"
  , chat: "チャット", connection: "接続", readPage: "現在のページを読み込む", pageReady: "読み込み済み：{title}",
  askPlaceholder: "このページについて質問…", send: "送信", summary: "要約", explain: "説明", keyPoints: "要点",
  translatePage: "翻訳", permissionNeeded: "このページへのアクセスを許可してください。", pageNotReady: "先に現在のページを読み込んでください。",
  agentMode: "Agent", agentDescription: "内蔵AgentはローカルBridge経由で現在のページを確認・操作できます。", agentPlaceholder: "このページで完了したいことを入力…",
  runAgent: "Agentを実行", agentSafety: "クリックには確認が必要です。パスワード、決済、CAPTCHA、削除、公開操作は禁止です。", approveAction: "ページ操作を承認しますか？", approve: "承認", cancelAgent: "タスクを停止"
};

const de: Dictionary = {
  connectionExperiment: "Lokale Verbindung", modelService: "Modelldienst", checking: "Wird geprüft", readingStatus: "Lokaler Verbindungsstatus wird geprüft…",
  connectOrca: "Mit OrcaRouter anmelden", verify: "Verbindung prüfen", disconnect: "Trennen", privacyTitle: "Lokaler Datenschutz",
  privacyCopy: "Der Autorisierungsschlüssel wird im lokalen Chrome-Erweiterungsspeicher nur für vertrauenswürdige Erweiterungskontexte gespeichert. Er wird weder an WebAgentMate-Server gesendet noch von Bridge dauerhaft gespeichert. Der Zugriff kann in OrcaRouter Authorized Apps widerrufen werden.",
  developerInfo: "Entwicklerinformationen", callbackUrl: "Callback-URL", authorizationProtocol: "Autorisierungsprotokoll", openingOrca: "OrcaRouter wird geöffnet…",
  disconnecting: "Verbindung wird getrennt…", connected: "Verbunden", notConnected: "Nicht verbunden", orcaConnected: "OrcaRouter ist verbunden.",
  keyDeleted: "Der lokale Schlüssel wurde gelöscht.", readingModels: "Verfügbare Modelle werden geladen…", modelsFound: "Verbindung bestätigt. {count} Modelle sind verfügbar.",
  connectedNoBridge: "OrcaRouter ist verbunden. Ohne Bridge sind lokale Unterhaltungen und CLI-Funktionen nicht verfügbar.",
  disconnectedNoBridge: "OrcaRouter kann jetzt verbunden werden. Bridge aktiviert lokale Unterhaltungen und CLI-Werkzeuge.",
  connectedWithBridge: "OrcaRouter ist verbunden und Bridge {version} ist verfügbar.", readyWithBridge: "Bei OrcaRouter anmelden. Der Schlüssel bleibt im vertrauenswürdigen lokalen Erweiterungsspeicher.",
  errorGeneric: "Ein Fehler ist aufgetreten. Bitte erneut versuchen.", errorAuthCancelled: "Die Autorisierung wurde abgebrochen.", errorAuthState: "Die Autorisierung konnte nicht validiert werden.",
  errorAuthCode: "Die Autorisierungsantwort enthält keinen Code.", errorAuthExchange: "Die OrcaRouter-Autorisierung konnte nicht abgeschlossen werden.",
  errorCredential: "Die gespeicherten OrcaRouter-Anmeldedaten sind ungültig oder abgelaufen.", errorProvider: "OrcaRouter ist vorübergehend nicht verfügbar.",
  language: "Sprache", languageAuto: "Browsersprache"
  , chat: "Chat", connection: "Verbindungen", readPage: "Aktuelle Seite lesen", pageReady: "Seite bereit: {title}",
  askPlaceholder: "Diese Seite fragen…", send: "Senden", summary: "Zusammenfassen", explain: "Erklären", keyPoints: "Kernaussagen",
  translatePage: "Übersetzen", permissionNeeded: "Bitte den Zugriff auf diese Seite erlauben.", pageNotReady: "Bitte zuerst die aktuelle Seite lesen.",
  agentMode: "Agent", agentDescription: "Der integrierte Agent kann die aktuelle Seite über die lokale Bridge prüfen und bedienen.", agentPlaceholder: "Beschreiben Sie die Aufgabe auf dieser Seite…",
  runAgent: "Agent starten", agentSafety: "Klicks erfordern eine Bestätigung. Passwörter, Zahlungen, CAPTCHA, Löschen und Veröffentlichen sind gesperrt.", approveAction: "Seitenaktion genehmigen?", approve: "Genehmigen", cancelAgent: "Aufgabe stoppen"
};

const ptBR: Dictionary = {
  connectionExperiment: "Conexão local", modelService: "Serviço de modelos", checking: "Verificando", readingStatus: "Verificando a conexão local…",
  connectOrca: "Entrar com OrcaRouter", verify: "Verificar conexão", disconnect: "Desconectar", privacyTitle: "Privacidade local",
  privacyCopy: "A chave de autorização fica no armazenamento local do Chrome, restrito aos contextos confiáveis da extensão. Ela não é enviada aos servidores do WebAgentMate nem persistida pelo Bridge. Você pode revogá-la em Authorized Apps no OrcaRouter.",
  developerInfo: "Informações de desenvolvimento", callbackUrl: "URL de retorno", authorizationProtocol: "Protocolo de autorização", openingOrca: "Abrindo o OrcaRouter…",
  disconnecting: "Desconectando…", connected: "Conectado", notConnected: "Não conectado", orcaConnected: "OrcaRouter conectado.",
  keyDeleted: "A chave local foi excluída.", readingModels: "Carregando modelos disponíveis…", modelsFound: "Conexão verificada. {count} modelos disponíveis.",
  connectedNoBridge: "O OrcaRouter está conectado. Sem o Bridge, conversas locais e recursos de CLI ficam indisponíveis.",
  disconnectedNoBridge: "Você já pode conectar o OrcaRouter. Instale o Bridge para ativar conversas locais e CLIs.",
  connectedWithBridge: "O OrcaRouter está conectado e o Bridge {version} está disponível.", readyWithBridge: "Entre no OrcaRouter. A chave ficará no armazenamento local confiável da extensão.",
  errorGeneric: "Ocorreu um erro. Tente novamente.", errorAuthCancelled: "A autorização foi cancelada.", errorAuthState: "Falha ao validar a autorização.",
  errorAuthCode: "A resposta de autorização não contém um código.", errorAuthExchange: "Não foi possível concluir a autorização do OrcaRouter.",
  errorCredential: "A credencial salva do OrcaRouter é inválida ou expirou.", errorProvider: "O OrcaRouter está temporariamente indisponível.",
  language: "Idioma", languageAuto: "Seguir o navegador"
  , chat: "Chat", connection: "Conexões", readPage: "Ler página atual", pageReady: "Página pronta: {title}",
  askPlaceholder: "Pergunte sobre esta página…", send: "Enviar", summary: "Resumir", explain: "Explicar", keyPoints: "Pontos principais",
  translatePage: "Traduzir", permissionNeeded: "Permita o acesso a esta página para continuar.", pageNotReady: "Leia primeiro a página atual.",
  agentMode: "Agent", agentDescription: "O agente integrado pode observar e operar a página atual pela Bridge local.", agentPlaceholder: "Descreva o que deseja concluir nesta página…",
  runAgent: "Executar agente", agentSafety: "Cliques exigem confirmação. Senhas, pagamentos, CAPTCHA, exclusão e publicação são bloqueados.", approveAction: "Aprovar ação na página?", approve: "Aprovar", cancelAgent: "Parar tarefa"
};

const dictionaries: Record<SupportedLanguage, Dictionary> = { en, zh_CN: zhCN, zh_TW: zhTW, pt_BR: ptBR, ja, de };

export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: LanguagePreference; label: string }> = [
  { value: "auto", label: "Auto" }, { value: "en", label: "English" }, { value: "zh_CN", label: "简体中文" },
  { value: "zh_TW", label: "繁體中文" }, { value: "pt_BR", label: "Português (Brasil)" },
  { value: "ja", label: "日本語" }, { value: "de", label: "Deutsch" }
];

export function getBrowserLanguage(): SupportedLanguage {
  const raw = chrome.i18n?.getUILanguage?.() || navigator.language || "en";
  const value = raw.toLowerCase().replace("_", "-");
  if (/^zh-(tw|hk|mo)(-|$)/.test(value)) return "zh_TW";
  if (value.startsWith("zh")) return "zh_CN";
  if (value.startsWith("pt")) return "pt_BR";
  if (value.startsWith("ja")) return "ja";
  if (value.startsWith("de")) return "de";
  return "en";
}

export function resolveLanguage(preference: LanguagePreference): SupportedLanguage {
  return preference === "auto" ? getBrowserLanguage() : preference;
}

export function translate(language: SupportedLanguage, key: TranslationKey, params: Record<string, string | number> = {}): string {
  let text = dictionaries[language][key] ?? en[key];
  for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}
