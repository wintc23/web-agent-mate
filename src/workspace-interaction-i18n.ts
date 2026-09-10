import type { SupportedLanguage } from "./locales";

const en = {
  autoApproved: "Automatically allowed", redirected: "Stopped to process your next message. Completed actions are preserved.",
  messageTooLong: "Messages can contain up to 50,000 characters.", queueFull: "The queue is full (20 messages). Edit or remove a queued message first.",
  queuedMessages: "Queued messages", queueHint: "Sent after the current task", queuePaused: "Ready when you resume",
  interruptSend: "Stop and send now", sendNow: "Send now", editQueued: "Move to draft", removeQueued: "Remove from queue",
  permissionMode: "Permissions", permissionButton: "Permissions: {mode}", permissionAutomatic: "Auto", permissionAsk: "Ask", permissionAuto: "Auto allow", permissionAskHint: "Ask before page changes, screenshots and local tool approvals.",
  permissionAutoHint: "Automatically approve tool operations in this conversation automatically. Questions still need an answer. Sensitive-field restrictions and agent policies still apply.",
  enqueue: "Add to queue", sendMessage: "Send", queueInputHint: "Enter to queue · Ctrl/⌘+Enter to stop and send · Shift+Enter for a new line"
};
export type InteractionKey = keyof typeof en;
const translations: Record<SupportedLanguage, Record<InteractionKey, string>> = {
  en,
  zh_CN: {
    autoApproved: "已自动允许", redirected: "已停止当前任务，接着处理你的新消息。已完成的操作会保留。",
    messageTooLong: "单条消息最多为 50,000 个字符。", queueFull: "队列已满（最多 20 条），请先编辑或移除待发送消息。",
    queuedMessages: "待发送", queueHint: "当前任务完成后发送", queuePaused: "点击发送以继续",
    interruptSend: "停止并立即发送", sendNow: "立即发送", editQueued: "移回输入框", removeQueued: "移出队列",
    permissionMode: "操作授权", permissionButton: "授权：{mode}", permissionAutomatic: "自动", permissionAsk: "询问", permissionAuto: "自动允许", permissionAskHint: "网页修改、截图及本地工具需要授权时，先询问你。",
    permissionAutoHint: "自动批准当前会话的工具操作；澄清问题仍需回答。敏感字段限制和智能体自身的权限规则仍然有效。",
    enqueue: "加入队列", sendMessage: "发送", queueInputHint: "Enter 排队 · Ctrl/⌘+Enter 停止并发送 · Shift+Enter 换行"
  },
  zh_TW: {
    autoApproved: "已自動允許", redirected: "已停止目前任務，接著處理你的新訊息。已完成的操作會保留。",
    messageTooLong: "單則訊息最多為 50,000 個字元。", queueFull: "佇列已滿（最多 20 則），請先編輯或移除待傳送訊息。",
    queuedMessages: "待傳送", queueHint: "目前任務完成後傳送", queuePaused: "點擊傳送以繼續",
    interruptSend: "停止並立即傳送", sendNow: "立即傳送", editQueued: "移回輸入框", removeQueued: "移出佇列",
    permissionMode: "操作授權", permissionButton: "授權：{mode}", permissionAutomatic: "自動", permissionAsk: "詢問", permissionAuto: "自動允許", permissionAskHint: "網頁修改、截圖及本機工具需要授權時，先詢問你。",
    permissionAutoHint: "自動批准目前會話的工具操作；釐清問題仍需回答。敏感欄位限制與智慧體本身的權限規則仍然有效。",
    enqueue: "加入佇列", sendMessage: "傳送", queueInputHint: "Enter 排隊 · Ctrl/⌘+Enter 停止並傳送 · Shift+Enter 換行"
  },
  ja: {
    autoApproved: "自動で許可しました", redirected: "現在のタスクを停止し、新しいメッセージを処理します。完了した操作は保持されます。",
    messageTooLong: "メッセージは50,000文字までです。", queueFull: "キューは20件までです。送信待ちのメッセージを編集または削除してください。",
    queuedMessages: "送信待ち", queueHint: "現在のタスクの完了後に送信", queuePaused: "送信を押すと再開します",
    interruptSend: "停止して今すぐ送信", sendNow: "今すぐ送信", editQueued: "入力欄に戻す", removeQueued: "キューから削除",
    permissionMode: "操作の許可", permissionButton: "許可：{mode}", permissionAutomatic: "自動", permissionAsk: "確認する", permissionAuto: "自動許可", permissionAskHint: "ページの変更、スクリーンショット、ローカルツールの許可を確認します。",
    permissionAutoHint: "この会話のツール操作を自動で許可します。質問への回答は必要です。機密入力欄の制限とエージェントの権限ルールは維持されます。",
    enqueue: "キューに追加", sendMessage: "送信", queueInputHint: "Enterでキューに追加 · Ctrl/⌘+Enterで停止して送信 · Shift+Enterで改行"
  },
  de: {
    autoApproved: "Automatisch erlaubt", redirected: "Gestoppt, um Ihre nächste Nachricht zu bearbeiten. Abgeschlossene Aktionen bleiben erhalten.",
    messageTooLong: "Nachrichten dürfen bis zu 50.000 Zeichen enthalten.", queueFull: "Die Warteschlange ist voll (20 Nachrichten). Bearbeiten oder entfernen Sie zuerst eine Nachricht.",
    queuedMessages: "Warteschlange", queueHint: "Versand nach der aktuellen Aufgabe", queuePaused: "Zum Fortsetzen auf Senden klicken",
    interruptSend: "Stoppen und jetzt senden", sendNow: "Jetzt senden", editQueued: "Zurück ins Eingabefeld", removeQueued: "Aus Warteschlange entfernen",
    permissionMode: "Berechtigungen", permissionButton: "Berechtigung: {mode}", permissionAutomatic: "Automatisch", permissionAsk: "Nachfragen", permissionAuto: "Automatisch erlauben", permissionAskHint: "Vor Seitenänderungen, Screenshots und lokalen Tool-Freigaben nachfragen.",
    permissionAutoHint: "Tool-Aktionen in dieser Unterhaltung automatisch erlauben. Fragen erfordern weiterhin eine Antwort. Regeln für sensible Felder und Agent-Berechtigungen bleiben bestehen.",
    enqueue: "Zur Warteschlange hinzufügen", sendMessage: "Senden", queueInputHint: "Enter: einreihen · Strg/⌘+Enter: stoppen und senden · Umschalt+Enter: neue Zeile"
  },
  pt_BR: {
    autoApproved: "Permitido automaticamente", redirected: "Tarefa interrompida para processar sua próxima mensagem. As ações concluídas foram preservadas.",
    messageTooLong: "As mensagens podem conter até 50.000 caracteres.", queueFull: "A fila está cheia (20 mensagens). Edite ou remova uma mensagem primeiro.",
    queuedMessages: "Na fila", queueHint: "Envio após a tarefa atual", queuePaused: "Clique em enviar para continuar",
    interruptSend: "Parar e enviar agora", sendNow: "Enviar agora", editQueued: "Mover para o rascunho", removeQueued: "Remover da fila",
    permissionMode: "Permissões", permissionButton: "Permissões: {mode}", permissionAutomatic: "Automático", permissionAsk: "Perguntar", permissionAuto: "Permitir automaticamente", permissionAskHint: "Perguntar antes de alterações na página, capturas de tela e aprovações de ferramentas locais.",
    permissionAutoHint: "Aprovar automaticamente as operações de ferramentas nesta conversa. Perguntas ainda precisam de resposta. Restrições de campos sensíveis e regras do agente continuam válidas.",
    enqueue: "Adicionar à fila", sendMessage: "Enviar", queueInputHint: "Enter: adicionar à fila · Ctrl/⌘+Enter: parar e enviar · Shift+Enter: nova linha"
  }
};
export function interactionText(language: SupportedLanguage, key: string): string | undefined {
  return Object.hasOwn(en, key) ? translations[language][key as InteractionKey] : undefined;
}
