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
  connectedNoBridge: "The full remote agent is ready without Bridge. Only local CLI tools are unavailable.",
  disconnectedNoBridge: "Connect OrcaRouter to use the remote agent. Bridge is only needed for local CLI tools.",
  connectedWithBridge: "OrcaRouter is connected and Bridge {version} is available.",
  readyWithBridge: "Sign in to OrcaRouter. The key will stay in trusted local extension storage.",
  errorGeneric: "Something went wrong. Please try again.", errorAuthCancelled: "Authorization was cancelled.",
  errorAuthState: "Authorization validation failed. Please try again.", errorAuthCode: "The authorization response did not include a code.",
  errorAuthExchange: "Could not complete OrcaRouter authorization.", errorCredential: "The saved OrcaRouter credential is invalid or expired.",
  errorProvider: "OrcaRouter is temporarily unavailable. Please try again.",
  errorRateLimit: "The free route is busy. Wait for the rate limit to reset and try again.",
  errorBalance: "This route needs account credit. Switch to Orca Free or add credit.",
  errorModel: "The selected OrcaRouter model is unavailable. Switch routes and try again.",
  errorFreePrompt: "This request is too large for the free route. Shorten it or switch to Orca Auto.",
  errorFreeUnavailable: "No free model can serve this request right now. Try later or switch to Orca Auto.",
  errorAccess: "This OrcaRouter key cannot make the request. Check its limits and access settings.",
  language: "Language", languageAuto: "Follow browser",
  runLocation: "Run on", remote: "Remote", local: "Local", model: "Model",
  freeModels: "Free models", paidModels: "Paid models", localAgent: "Local Agent", noLocalAgents: "No local Agents",
  pageContext: "Page context", switchModel: "Switch model or Agent",
  chooseModel: "Choose a model", chooseModelDescription: "Use an OrcaRouter model or an Agent available on this computer.",
  freeLimitTitle: "Free quota reached", freeLimitCopy: "Choose a paid model or a local Agent to continue.",
  freePromptTitle: "Request is too large for Free", freePromptCopy: "Shorten the request, choose a paid model, or use a local Agent.",
  remoteModelsDescription: "No Bridge required. The agent can read, summarize, translate, and operate the current page.", localAgentsDescription: "Page context is passed to the selected local CLI through Bridge.",
  free: "Free", paid: "Paid", back: "Back", settingsNavigation: "Settings sections", about: "About",
  conversation: "Conversation", newConversationDescription: "Clear the current messages and start with an empty conversation.",
  aboutDescription: "A focused side-panel assistant for understanding and safely operating the current page.", version: "Version"
  , chat: "Conversation", connection: "Connections", readPage: "Read current page", pageReady: "Page ready: {title}",
  send: "Send", summary: "Summarize", explain: "Explain", keyPoints: "Key points",
  translatePage: "Translate", permissionNeeded: "Allow access to this page to continue.", pageNotReady: "Read the current page first.",
  agentDescription: "The built-in agent can inspect and operate the current page without Bridge.",
  agentPlaceholder: "Ask anything or describe a page task…", agentSafety: "Clicks require approval. Passwords, payments, CAPTCHA, deletion and publishing are blocked.",
  approveAction: "Approve page action?", approve: "Approve", cancelAgent: "Stop task"
  , agentProvider: "Agent provider", unavailable: "Unavailable", verified: "Verified", unverified: "Needs verification",
  welcomeTitle: "What should I do?", welcomeBody: "Ask, summarize, translate, or describe a page task. The agent chooses the right tools automatically.",
  more: "More", close: "Close", newConversation: "New conversation", settings: "Settings",
  appearance: "Appearance", theme: "Theme", themeSystem: "Follow system", themeLight: "Light", themeDark: "Dark",
  currentPage: "Current page · not read", refresh: "Refresh", ready: "Ready",
  configureAI: "Configure an AI connection", stopping: "Stopping…",
  thinking: "Thinking…", taskRunning: "Working on the page…", requestStopped: "Stopped by you.",
  rejectAndStop: "Reject and stop", taskProgress: "{count} of 12 steps", backToLatest: "Latest",
  modelRoute: "OrcaRouter route", orcaFree: "Orca Free", orcaAuto: "Orca Auto"
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
  connectedNoBridge: "无需 Bridge，远端智能体已可完整使用；仅本地 CLI 工具不可用。",
  disconnectedNoBridge: "连接 OrcaRouter 即可使用远端智能体；只有本地 CLI 工具需要 Bridge。",
  connectedWithBridge: "OrcaRouter 已连接，Bridge {version} 可用。", readyWithBridge: "登录并授权 WebAgentMate；Key 将保存在扩展的本地可信存储区。",
  errorGeneric: "发生错误，请重试。", errorAuthCancelled: "授权已取消。", errorAuthState: "授权状态校验失败，请重试。",
  errorAuthCode: "授权结果中缺少一次性代码。", errorAuthExchange: "无法完成 OrcaRouter 授权。",
  errorCredential: "保存的 OrcaRouter 凭据无效或已过期。", errorProvider: "OrcaRouter 暂时不可用，请稍后重试。",
  errorRateLimit: "免费路由当前繁忙，请等待限流恢复后重试。", errorBalance: "当前路由需要账户余额，请切换到 Orca 免费路由或充值。",
  errorModel: "所选 OrcaRouter 模型当前不可用，请切换路由后重试。",
  errorFreePrompt: "本次请求超过免费路由的上下文限制，请缩短内容或切换到 Orca 自动。",
  errorFreeUnavailable: "当前没有免费模型可处理本次请求，请稍后重试或切换到 Orca 自动。",
  errorAccess: "当前 OrcaRouter Key 无权执行请求，请检查 Key 限额与访问设置。",
  language: "语言", languageAuto: "跟随浏览器",
  runLocation: "运行位置", remote: "远端", local: "本地", model: "模型",
  freeModels: "免费模型", paidModels: "付费模型", localAgent: "本地 Agent", noLocalAgents: "没有本地 Agent",
  pageContext: "网页上下文", switchModel: "切换模型或 Agent",
  chooseModel: "选择模型", chooseModelDescription: "选择 OrcaRouter 模型或这台电脑上可用的 Agent。",
  freeLimitTitle: "免费额度已用完", freeLimitCopy: "请选择付费模型或本地 Agent 继续。",
  freePromptTitle: "内容超过免费模型上限", freePromptCopy: "请缩短内容、选择付费模型或使用本地 Agent。",
  remoteModelsDescription: "无需 Bridge。智能体可读取、总结、翻译并操作当前网页。", localAgentsDescription: "网页内容会通过 Bridge 交给所选本地 CLI。",
  free: "免费", paid: "付费", back: "返回", settingsNavigation: "设置分类", about: "关于",
  conversation: "对话", newConversationDescription: "清空当前消息并开始一段新对话。",
  aboutDescription: "用于理解当前网页并安全完成网页操作的侧边栏助手。", version: "版本"
  , chat: "对话", connection: "连接", readPage: "读取当前网页", pageReady: "已读取：{title}",
  send: "发送", summary: "总结", explain: "解释", keyPoints: "关键要点",
  translatePage: "翻译", permissionNeeded: "请允许访问当前网页后继续。", pageNotReady: "请先读取当前网页。",
  agentDescription: "内置 Agent 无需 Bridge 即可理解并操作当前网页。", agentPlaceholder: "提问，或描述希望在网页上完成的事情…",
  agentSafety: "点击操作需要确认；禁止密码、支付、验证码、删除和发布操作。", approveAction: "批准网页操作？", approve: "批准", cancelAgent: "停止任务"
  , agentProvider: "Agent 来源", unavailable: "不可用", verified: "已验证", unverified: "待验证",
  welcomeTitle: "想让我做什么？", welcomeBody: "直接提问、总结、翻译或描述网页任务，智能体会自动选择合适的工具。",
  more: "更多", close: "关闭", newConversation: "新建对话", settings: "设置",
  appearance: "外观", theme: "主题", themeSystem: "跟随系统", themeLight: "浅色", themeDark: "深色",
  currentPage: "当前网页 · 未读取", refresh: "刷新", ready: "可用",
  configureAI: "配置 AI 连接", stopping: "正在停止…",
  thinking: "正在思考…", taskRunning: "正在操作网页…", requestStopped: "已由你停止。",
  rejectAndStop: "拒绝并停止", taskProgress: "已执行 {count} / 12 步", backToLatest: "回到最新",
  modelRoute: "OrcaRouter 路由", orcaFree: "Orca 免费", orcaAuto: "Orca 自动"
};

const zhTW: Dictionary = {
  connectionExperiment: "本機連線", modelService: "模型服務", checking: "檢查中", readingStatus: "正在讀取本機連線狀態…",
  connectOrca: "使用 OrcaRouter 登入", verify: "驗證連線", disconnect: "中斷連線", privacyTitle: "本機優先隱私",
  privacyCopy: "授權金鑰保存在 Chrome 擴充功能的本機可信儲存區，不會傳送到 WebAgentMate 伺服器，Bridge 也不會永久保存。你可以在 OrcaRouter Authorized Apps 中撤銷授權。",
  developerInfo: "開發資訊", callbackUrl: "回呼網址", authorizationProtocol: "授權協定", openingOrca: "正在開啟 OrcaRouter…",
  disconnecting: "正在中斷…", connected: "已連線", notConnected: "未連線", orcaConnected: "OrcaRouter 已連線。",
  keyDeleted: "本機金鑰已刪除。", readingModels: "正在讀取可用模型…", modelsFound: "連線正常，可使用 {count} 個模型。",
  connectedNoBridge: "無需 Bridge，遠端智慧體已可完整使用；僅本機 CLI 工具不可用。",
  disconnectedNoBridge: "連線 OrcaRouter 即可使用遠端智慧體；只有本機 CLI 工具需要 Bridge。",
  connectedWithBridge: "OrcaRouter 已連線，Bridge {version} 可用。", readyWithBridge: "登入 OrcaRouter；金鑰將保存在擴充功能的本機可信儲存區。",
  errorGeneric: "發生錯誤，請再試一次。", errorAuthCancelled: "授權已取消。", errorAuthState: "授權狀態驗證失敗，請再試一次。",
  errorAuthCode: "授權回應缺少一次性代碼。", errorAuthExchange: "無法完成 OrcaRouter 授權。",
  errorCredential: "保存的 OrcaRouter 憑證無效或已過期。", errorProvider: "OrcaRouter 暫時無法使用，請稍後再試。",
  errorRateLimit: "免費路由目前忙碌，請等待限流解除後再試。", errorBalance: "目前路由需要帳戶餘額，請切換到 Orca 免費或儲值。",
  errorModel: "所選 OrcaRouter 模型目前無法使用，請切換路由後再試。",
  errorFreePrompt: "本次請求超過免費路由的內容限制，請縮短內容或切換到 Orca 自動。",
  errorFreeUnavailable: "目前沒有免費模型可處理本次請求，請稍後再試或切換到 Orca 自動。",
  errorAccess: "目前的 OrcaRouter 金鑰無權執行請求，請檢查限額與存取設定。",
  language: "語言", languageAuto: "跟隨瀏覽器",
  runLocation: "執行位置", remote: "遠端", local: "本機", model: "模型",
  freeModels: "免費模型", paidModels: "付費模型", localAgent: "本機 Agent", noLocalAgents: "沒有本機 Agent",
  pageContext: "網頁內容", switchModel: "切換模型或 Agent",
  chooseModel: "選擇模型", chooseModelDescription: "選擇 OrcaRouter 模型或這台電腦上可用的 Agent。",
  freeLimitTitle: "免費額度已用完", freeLimitCopy: "請選擇付費模型或本機 Agent 繼續。",
  freePromptTitle: "內容超過免費模型上限", freePromptCopy: "請縮短內容、選擇付費模型或使用本機 Agent。",
  remoteModelsDescription: "無需 Bridge。智慧體可讀取、摘要、翻譯並操作目前網頁。", localAgentsDescription: "網頁內容會透過 Bridge 交給所選本機 CLI。",
  free: "免費", paid: "付費", back: "返回", settingsNavigation: "設定分類", about: "關於",
  conversation: "對話", newConversationDescription: "清除目前訊息並開始新對話。",
  aboutDescription: "用於理解目前網頁並安全完成網頁操作的側邊欄助理。", version: "版本"
  , chat: "對話", connection: "連線", readPage: "讀取目前網頁", pageReady: "已讀取：{title}",
  send: "傳送", summary: "摘要", explain: "解釋", keyPoints: "重點",
  translatePage: "翻譯", permissionNeeded: "請允許存取目前網頁後繼續。", pageNotReady: "請先讀取目前網頁。",
  agentDescription: "內建 Agent 無需 Bridge 即可理解並操作目前網頁。", agentPlaceholder: "提問，或描述希望在網頁上完成的事情…",
  agentSafety: "點擊操作需要確認；禁止密碼、付款、驗證碼、刪除和發佈操作。", approveAction: "核准網頁操作？", approve: "核准", cancelAgent: "停止任務"
  , agentProvider: "Agent 來源", unavailable: "無法使用", verified: "已驗證", unverified: "待驗證",
  welcomeTitle: "想讓我做什麼？", welcomeBody: "直接提問、摘要、翻譯或描述網頁任務，智慧體會自動選擇合適的工具。",
  more: "更多", close: "關閉", newConversation: "新增對話", settings: "設定",
  appearance: "外觀", theme: "主題", themeSystem: "跟隨系統", themeLight: "淺色", themeDark: "深色",
  currentPage: "目前網頁 · 未讀取", refresh: "重新整理", ready: "可用",
  configureAI: "設定 AI 連線", stopping: "正在停止…",
  thinking: "正在思考…", taskRunning: "正在操作網頁…", requestStopped: "已由你停止。",
  rejectAndStop: "拒絕並停止", taskProgress: "已執行 {count} / 12 步", backToLatest: "回到最新",
  modelRoute: "OrcaRouter 路由", orcaFree: "Orca 免費", orcaAuto: "Orca 自動"
};

const ja: Dictionary = {
  connectionExperiment: "ローカル接続", modelService: "モデルサービス", checking: "確認中", readingStatus: "接続状態を確認しています…",
  connectOrca: "OrcaRouterでサインイン", verify: "接続を確認", disconnect: "接続を解除", privacyTitle: "ローカル優先のプライバシー",
  privacyCopy: "認証キーは、信頼された拡張機能コンテキストに限定されたChromeのローカルストレージに保存されます。WebAgentMateサーバーには送信されず、Bridgeにも永続保存されません。OrcaRouterのAuthorized Appsから取り消せます。",
  developerInfo: "開発情報", callbackUrl: "コールバックURL", authorizationProtocol: "認証プロトコル", openingOrca: "OrcaRouterを開いています…",
  disconnecting: "切断しています…", connected: "接続済み", notConnected: "未接続", orcaConnected: "OrcaRouterに接続しました。",
  keyDeleted: "ローカルキーを削除しました。", readingModels: "利用可能なモデルを取得しています…", modelsFound: "接続を確認しました。{count}個のモデルを利用できます。",
  connectedNoBridge: "BridgeなしでリモートAgentを利用できます。ローカルCLIツールのみ利用できません。",
  disconnectedNoBridge: "OrcaRouterに接続するとリモートAgentを利用できます。BridgeはローカルCLIにのみ必要です。",
  connectedWithBridge: "OrcaRouterに接続済みで、Bridge {version}を利用できます。", readyWithBridge: "OrcaRouterにサインインしてください。キーは拡張機能の信頼済みローカルストレージに保存されます。",
  errorGeneric: "エラーが発生しました。もう一度お試しください。", errorAuthCancelled: "認証がキャンセルされました。", errorAuthState: "認証の検証に失敗しました。",
  errorAuthCode: "認証応答にコードがありません。", errorAuthExchange: "OrcaRouter認証を完了できませんでした。",
  errorCredential: "保存されたOrcaRouter認証情報が無効か期限切れです。", errorProvider: "OrcaRouterは一時的に利用できません。",
  errorRateLimit: "無料ルートが混雑しています。レート制限の解除後に再試行してください。", errorBalance: "このルートには残高が必要です。Orca Freeに切り替えるか、チャージしてください。",
  errorModel: "選択したOrcaRouterモデルは利用できません。ルートを切り替えてください。",
  errorFreePrompt: "このリクエストは無料ルートの上限を超えています。短くするかOrca Autoへ切り替えてください。",
  errorFreeUnavailable: "現在このリクエストを処理できる無料モデルがありません。後で再試行するかOrca Autoへ切り替えてください。",
  errorAccess: "このOrcaRouterキーではリクエストできません。上限とアクセス設定を確認してください。",
  language: "言語", languageAuto: "ブラウザに合わせる",
  runLocation: "実行場所", remote: "リモート", local: "ローカル", model: "モデル",
  freeModels: "無料モデル", paidModels: "有料モデル", localAgent: "ローカルAgent", noLocalAgents: "ローカルAgentなし",
  pageContext: "ページコンテキスト", switchModel: "モデルまたはAgentを切り替え",
  chooseModel: "モデルを選択", chooseModelDescription: "OrcaRouterモデルまたはこの端末のAgentを選びます。",
  freeLimitTitle: "無料枠に達しました", freeLimitCopy: "有料モデルまたはローカルAgentを選択してください。",
  freePromptTitle: "無料モデルには長すぎます", freePromptCopy: "内容を短くするか、有料モデルまたはローカルAgentを選択してください。",
  remoteModelsDescription: "Bridgeは不要です。Agentは現在のページを読み、要約・翻訳・操作できます。", localAgentsDescription: "ページ内容はBridge経由で選択したローカルCLIに渡されます。",
  free: "無料", paid: "有料", back: "戻る", settingsNavigation: "設定セクション", about: "このアプリについて",
  conversation: "会話", newConversationDescription: "現在のメッセージを消去して新しい会話を開始します。",
  aboutDescription: "現在のページを理解し、安全に操作するためのサイドパネルアシスタントです。", version: "バージョン"
  , chat: "会話", connection: "接続", readPage: "現在のページを読み込む", pageReady: "読み込み済み：{title}",
  send: "送信", summary: "要約", explain: "説明", keyPoints: "要点",
  translatePage: "翻訳", permissionNeeded: "このページへのアクセスを許可してください。", pageNotReady: "先に現在のページを読み込んでください。",
  agentDescription: "内蔵AgentはBridgeなしで現在のページを理解・操作できます。", agentPlaceholder: "質問またはページで行うタスクを入力…",
  agentSafety: "クリックには確認が必要です。パスワード、決済、CAPTCHA、削除、公開操作は禁止です。", approveAction: "ページ操作を承認しますか？", approve: "承認", cancelAgent: "タスクを停止"
  , agentProvider: "Agentプロバイダー", unavailable: "利用不可", verified: "確認済み", unverified: "未確認",
  welcomeTitle: "何をしましょうか？", welcomeBody: "質問、要約、翻訳、ページ操作を入力してください。Agentが適切なツールを自動で選びます。",
  more: "その他", close: "閉じる", newConversation: "新しい会話", settings: "設定",
  appearance: "外観", theme: "テーマ", themeSystem: "システムに合わせる", themeLight: "ライト", themeDark: "ダーク",
  currentPage: "現在のページ・未読", refresh: "更新", ready: "利用可能",
  configureAI: "AI接続を設定", stopping: "停止しています…",
  thinking: "考えています…", taskRunning: "ページを操作しています…", requestStopped: "停止しました。",
  rejectAndStop: "拒否して停止", taskProgress: "{count} / 12 ステップ", backToLatest: "最新へ",
  modelRoute: "OrcaRouterルート", orcaFree: "Orca Free", orcaAuto: "Orca Auto"
};

const de: Dictionary = {
  connectionExperiment: "Lokale Verbindung", modelService: "Modelldienst", checking: "Wird geprüft", readingStatus: "Lokaler Verbindungsstatus wird geprüft…",
  connectOrca: "Mit OrcaRouter anmelden", verify: "Verbindung prüfen", disconnect: "Trennen", privacyTitle: "Lokaler Datenschutz",
  privacyCopy: "Der Autorisierungsschlüssel wird im lokalen Chrome-Erweiterungsspeicher nur für vertrauenswürdige Erweiterungskontexte gespeichert. Er wird weder an WebAgentMate-Server gesendet noch von Bridge dauerhaft gespeichert. Der Zugriff kann in OrcaRouter Authorized Apps widerrufen werden.",
  developerInfo: "Entwicklerinformationen", callbackUrl: "Callback-URL", authorizationProtocol: "Autorisierungsprotokoll", openingOrca: "OrcaRouter wird geöffnet…",
  disconnecting: "Verbindung wird getrennt…", connected: "Verbunden", notConnected: "Nicht verbunden", orcaConnected: "OrcaRouter ist verbunden.",
  keyDeleted: "Der lokale Schlüssel wurde gelöscht.", readingModels: "Verfügbare Modelle werden geladen…", modelsFound: "Verbindung bestätigt. {count} Modelle sind verfügbar.",
  connectedNoBridge: "Der Remote-Agent ist ohne Bridge einsatzbereit. Nur lokale CLI-Werkzeuge sind nicht verfügbar.",
  disconnectedNoBridge: "OrcaRouter verbindet den Remote-Agent. Bridge wird nur für lokale CLI-Werkzeuge benötigt.",
  connectedWithBridge: "OrcaRouter ist verbunden und Bridge {version} ist verfügbar.", readyWithBridge: "Bei OrcaRouter anmelden. Der Schlüssel bleibt im vertrauenswürdigen lokalen Erweiterungsspeicher.",
  errorGeneric: "Ein Fehler ist aufgetreten. Bitte erneut versuchen.", errorAuthCancelled: "Die Autorisierung wurde abgebrochen.", errorAuthState: "Die Autorisierung konnte nicht validiert werden.",
  errorAuthCode: "Die Autorisierungsantwort enthält keinen Code.", errorAuthExchange: "Die OrcaRouter-Autorisierung konnte nicht abgeschlossen werden.",
  errorCredential: "Die gespeicherten OrcaRouter-Anmeldedaten sind ungültig oder abgelaufen.", errorProvider: "OrcaRouter ist vorübergehend nicht verfügbar.",
  errorRateLimit: "Die kostenlose Route ist ausgelastet. Bitte nach Ablauf des Limits erneut versuchen.", errorBalance: "Diese Route benötigt Guthaben. Zu Orca Free wechseln oder Guthaben aufladen.",
  errorModel: "Das gewählte OrcaRouter-Modell ist nicht verfügbar. Bitte die Route wechseln.",
  errorFreePrompt: "Diese Anfrage ist für die kostenlose Route zu groß. Bitte kürzen oder zu Orca Auto wechseln.",
  errorFreeUnavailable: "Derzeit kann kein kostenloses Modell diese Anfrage bearbeiten. Später erneut versuchen oder zu Orca Auto wechseln.",
  errorAccess: "Dieser OrcaRouter-Schlüssel darf die Anfrage nicht ausführen. Limits und Zugriffseinstellungen prüfen.",
  language: "Sprache", languageAuto: "Browsersprache",
  runLocation: "Ausführen auf", remote: "Remote", local: "Lokal", model: "Modell",
  freeModels: "Kostenlose Modelle", paidModels: "Kostenpflichtige Modelle", localAgent: "Lokaler Agent", noLocalAgents: "Keine lokalen Agents",
  pageContext: "Seitenkontext", switchModel: "Modell oder Agent wechseln",
  chooseModel: "Modell auswählen", chooseModelDescription: "OrcaRouter-Modell oder verfügbaren lokalen Agent auswählen.",
  freeLimitTitle: "Kostenloses Kontingent erreicht", freeLimitCopy: "Kostenpflichtiges Modell oder lokalen Agent auswählen.",
  freePromptTitle: "Anfrage ist zu groß", freePromptCopy: "Anfrage kürzen oder ein kostenpflichtiges Modell bzw. einen lokalen Agent verwenden.",
  remoteModelsDescription: "Keine Bridge erforderlich. Der Agent kann die Seite lesen, zusammenfassen, übersetzen und bedienen.", localAgentsDescription: "Der Seitenkontext wird über Bridge an die gewählte lokale CLI übergeben.",
  free: "Kostenlos", paid: "Kostenpflichtig", back: "Zurück", settingsNavigation: "Einstellungsbereiche", about: "Über",
  conversation: "Unterhaltung", newConversationDescription: "Aktuelle Nachrichten löschen und eine neue Unterhaltung beginnen.",
  aboutDescription: "Ein Seitenleisten-Assistent zum Verstehen und sicheren Bedienen der aktuellen Seite.", version: "Version"
  , chat: "Unterhaltung", connection: "Verbindungen", readPage: "Aktuelle Seite lesen", pageReady: "Seite bereit: {title}",
  send: "Senden", summary: "Zusammenfassen", explain: "Erklären", keyPoints: "Kernaussagen",
  translatePage: "Übersetzen", permissionNeeded: "Bitte den Zugriff auf diese Seite erlauben.", pageNotReady: "Bitte zuerst die aktuelle Seite lesen.",
  agentDescription: "Der integrierte Agent versteht und bedient die Seite auch ohne Bridge.", agentPlaceholder: "Frage stellen oder eine Seitenaufgabe beschreiben…",
  agentSafety: "Klicks erfordern eine Bestätigung. Passwörter, Zahlungen, CAPTCHA, Löschen und Veröffentlichen sind gesperrt.", approveAction: "Seitenaktion genehmigen?", approve: "Genehmigen", cancelAgent: "Aufgabe stoppen"
  , agentProvider: "Agent-Anbieter", unavailable: "Nicht verfügbar", verified: "Bestätigt", unverified: "Nicht bestätigt",
  welcomeTitle: "Was soll ich tun?", welcomeBody: "Fragen, zusammenfassen, übersetzen oder eine Seitenaufgabe beschreiben. Der Agent wählt die passenden Werkzeuge.",
  more: "Mehr", close: "Schließen", newConversation: "Neue Unterhaltung", settings: "Einstellungen",
  appearance: "Darstellung", theme: "Design", themeSystem: "Systemeinstellung", themeLight: "Hell", themeDark: "Dunkel",
  currentPage: "Aktuelle Seite · nicht gelesen", refresh: "Aktualisieren", ready: "Bereit",
  configureAI: "AI-Verbindung einrichten", stopping: "Wird gestoppt…",
  thinking: "Denke nach…", taskRunning: "Seite wird bearbeitet…", requestStopped: "Von Ihnen gestoppt.",
  rejectAndStop: "Ablehnen und stoppen", taskProgress: "{count} von 12 Schritten", backToLatest: "Neueste",
  modelRoute: "OrcaRouter-Route", orcaFree: "Orca Free", orcaAuto: "Orca Auto"
};

const ptBR: Dictionary = {
  connectionExperiment: "Conexão local", modelService: "Serviço de modelos", checking: "Verificando", readingStatus: "Verificando a conexão local…",
  connectOrca: "Entrar com OrcaRouter", verify: "Verificar conexão", disconnect: "Desconectar", privacyTitle: "Privacidade local",
  privacyCopy: "A chave de autorização fica no armazenamento local do Chrome, restrito aos contextos confiáveis da extensão. Ela não é enviada aos servidores do WebAgentMate nem persistida pelo Bridge. Você pode revogá-la em Authorized Apps no OrcaRouter.",
  developerInfo: "Informações de desenvolvimento", callbackUrl: "URL de retorno", authorizationProtocol: "Protocolo de autorização", openingOrca: "Abrindo o OrcaRouter…",
  disconnecting: "Desconectando…", connected: "Conectado", notConnected: "Não conectado", orcaConnected: "OrcaRouter conectado.",
  keyDeleted: "A chave local foi excluída.", readingModels: "Carregando modelos disponíveis…", modelsFound: "Conexão verificada. {count} modelos disponíveis.",
  connectedNoBridge: "O agente remoto está pronto sem o Bridge. Apenas as ferramentas de CLI local estão indisponíveis.",
  disconnectedNoBridge: "Conecte o OrcaRouter para usar o agente remoto. O Bridge só é necessário para CLIs locais.",
  connectedWithBridge: "O OrcaRouter está conectado e o Bridge {version} está disponível.", readyWithBridge: "Entre no OrcaRouter. A chave ficará no armazenamento local confiável da extensão.",
  errorGeneric: "Ocorreu um erro. Tente novamente.", errorAuthCancelled: "A autorização foi cancelada.", errorAuthState: "Falha ao validar a autorização.",
  errorAuthCode: "A resposta de autorização não contém um código.", errorAuthExchange: "Não foi possível concluir a autorização do OrcaRouter.",
  errorCredential: "A credencial salva do OrcaRouter é inválida ou expirou.", errorProvider: "O OrcaRouter está temporariamente indisponível.",
  errorRateLimit: "A rota gratuita está ocupada. Aguarde o limite de taxa e tente novamente.", errorBalance: "Esta rota exige saldo. Mude para Orca Free ou adicione créditos.",
  errorModel: "O modelo selecionado do OrcaRouter está indisponível. Troque a rota e tente novamente.",
  errorFreePrompt: "A solicitação é grande demais para a rota gratuita. Reduza o conteúdo ou mude para Orca Auto.",
  errorFreeUnavailable: "Nenhum modelo gratuito pode atender esta solicitação agora. Tente depois ou mude para Orca Auto.",
  errorAccess: "Esta chave do OrcaRouter não pode fazer a solicitação. Verifique limites e configurações de acesso.",
  language: "Idioma", languageAuto: "Seguir o navegador",
  runLocation: "Executar em", remote: "Remoto", local: "Local", model: "Modelo",
  freeModels: "Modelos grátis", paidModels: "Modelos pagos", localAgent: "Agente local", noLocalAgents: "Sem agentes locais",
  pageContext: "Contexto da página", switchModel: "Trocar modelo ou agente",
  chooseModel: "Escolher modelo", chooseModelDescription: "Use um modelo OrcaRouter ou um agente disponível neste computador.",
  freeLimitTitle: "Cota gratuita atingida", freeLimitCopy: "Escolha um modelo pago ou um agente local para continuar.",
  freePromptTitle: "Solicitação grande demais", freePromptCopy: "Reduza o conteúdo ou use um modelo pago ou agente local.",
  remoteModelsDescription: "Não requer Bridge. O agente pode ler, resumir, traduzir e operar a página atual.", localAgentsDescription: "O contexto da página passa pela Bridge para a CLI local escolhida.",
  free: "Grátis", paid: "Pago", back: "Voltar", settingsNavigation: "Seções de configurações", about: "Sobre",
  conversation: "Conversa", newConversationDescription: "Limpe as mensagens atuais e inicie uma conversa vazia.",
  aboutDescription: "Um assistente lateral para entender e operar com segurança a página atual.", version: "Versão"
  , chat: "Conversa", connection: "Conexões", readPage: "Ler página atual", pageReady: "Página pronta: {title}",
  send: "Enviar", summary: "Resumir", explain: "Explicar", keyPoints: "Pontos principais",
  translatePage: "Traduzir", permissionNeeded: "Permita o acesso a esta página para continuar.", pageNotReady: "Leia primeiro a página atual.",
  agentDescription: "O agente integrado entende e opera a página sem o Bridge.", agentPlaceholder: "Pergunte ou descreva uma tarefa na página…",
  agentSafety: "Cliques exigem confirmação. Senhas, pagamentos, CAPTCHA, exclusão e publicação são bloqueados.", approveAction: "Aprovar ação na página?", approve: "Aprovar", cancelAgent: "Parar tarefa"
  , agentProvider: "Provedor do agente", unavailable: "Indisponível", verified: "Verificado", unverified: "Não verificado",
  welcomeTitle: "O que devo fazer?", welcomeBody: "Pergunte, resuma, traduza ou descreva uma tarefa. O agente escolhe as ferramentas automaticamente.",
  more: "Mais", close: "Fechar", newConversation: "Nova conversa", settings: "Configurações",
  appearance: "Aparência", theme: "Tema", themeSystem: "Seguir sistema", themeLight: "Claro", themeDark: "Escuro",
  currentPage: "Página atual · não lida", refresh: "Atualizar", ready: "Disponível",
  configureAI: "Configurar conexão de IA", stopping: "Parando…",
  thinking: "Pensando…", taskRunning: "Operando a página…", requestStopped: "Interrompido por você.",
  rejectAndStop: "Rejeitar e parar", taskProgress: "{count} de 12 etapas", backToLatest: "Mais recente",
  modelRoute: "Rota do OrcaRouter", orcaFree: "Orca Free", orcaAuto: "Orca Auto"
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
