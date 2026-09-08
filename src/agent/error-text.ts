import type { SupportedLanguage } from "../locales";
import { readProviderIssue } from "./provider-error";
import { providerReason } from "../provider-error-i18n";

const messages: Record<SupportedLanguage, { auth: string; timeout: string; context: string }> = {
  en: { auth: "Claude Code needs a fresh login. Run `claude auth login` in a terminal, then continue this conversation.", timeout: "The model or local runtime stopped responding. Your conversation is saved; inspect completed actions before continuing.", context: "This model could not fit the conversation context. Your original history is saved. Choose a model with more context or start a shorter conversation." },
  zh_CN: { auth: "Claude Code 需要重新登录。请在终端运行 `claude auth login`，完成后继续这个会话。", timeout: "模型或本地运行环境响应超时。会话已保存，继续前请检查已完成的操作。", context: "当前模型的上下文不足，或整理历史失败。原始记录已保存，请选择上下文更大的模型，或创建较短的新会话。" },
  zh_TW: { auth: "Claude Code 需要重新登入。請在終端執行 `claude auth login`，完成後繼續這個會話。", timeout: "模型或本機執行環境回應逾時。會話已儲存，繼續前請檢查已完成的操作。", context: "模型的上下文不足，或整理歷史失敗。原始記錄已儲存，請選擇上下文更大的模型，或建立較短的新會話。" },
  ja: { auth: "Claude Code に再ログインしてください。ターミナルで `claude auth login` を実行してから、この会話を続行できます。", timeout: "モデルまたは実行環境がタイムアウトしました。会話は保存されています。続行する前に完了済みの操作を確認してください。", context: "会話がモデルのコンテキストに収まりませんでした。元の履歴は保存されています。より大きなコンテキストのモデルを選ぶか、短い会話を開始してください。" },
  de: { auth: "Melden Sie sich erneut bei Claude Code an: Führen Sie `claude auth login` im Terminal aus und setzen Sie die Unterhaltung fort.", timeout: "Das Modell oder die lokale Laufzeit antwortet nicht mehr. Die Unterhaltung ist gespeichert. Prüfen Sie ausgeführte Aktionen vor dem Fortsetzen.", context: "Die Unterhaltung passt nicht in den Modellkontext. Der ursprüngliche Verlauf bleibt gespeichert. Wählen Sie ein Modell mit mehr Kontext oder beginnen Sie eine kürzere Unterhaltung." },
  pt_BR: { auth: "Entre novamente no Claude Code. Execute `claude auth login` no terminal e continue esta conversa.", timeout: "O modelo ou o ambiente local parou de responder. A conversa foi salva. Confira as ações concluídas antes de continuar.", context: "A conversa não coube no contexto do modelo. O histórico original foi salvo. Escolha um modelo com mais contexto ou inicie uma conversa mais curta." }
};
const loopMessages: Record<SupportedLanguage, { limit: string; failures: string; noProgress: string }> = {
  en: { limit: "Paused at your tool-call limit. Results are saved. Increase or disable the limit in the conversation configuration, then continue.", failures: "Paused after 8 consecutive tool failures. Results are saved. Check the errors, adjust the task or environment, then continue.", noProgress: "Paused after 12 tool calls repeated the same actions and results. Results are saved. Review progress and provide a new direction to continue." },
  zh_CN: { limit: "已达到你设置的工具调用上限，结果已保存。可在会话配置中提高或关闭上限，再继续任务。", failures: "工具连续失败 8 次，任务已暂停，结果已保存。请检查错误，调整任务或运行环境后继续。", noProgress: "最近 12 次工具调用重复相同操作和结果，任务已暂停，结果已保存。请检查进展并补充指示后继续。" },
  zh_TW: { limit: "已達到你設定的工具呼叫上限，結果已儲存。可在會話設定中提高或關閉上限，再繼續任務。", failures: "工具連續失敗 8 次，任務已暫停，結果已儲存。請檢查錯誤，調整任務或執行環境後繼續。", noProgress: "最近 12 次工具呼叫重複相同操作與結果，任務已暫停，結果已儲存。請檢查進展並補充指示後繼續。" },
  ja: { limit: "設定したツール呼び出し上限に達したため一時停止しました。結果は保存済みです。会話設定で上限を増やすか無効にして続行してください。", failures: "ツールが8回連続で失敗したため一時停止しました。結果は保存済みです。エラーを確認し、タスクや環境を調整して続行してください。", noProgress: "直近12回のツール呼び出しで同じ操作と結果が繰り返されたため一時停止しました。結果は保存済みです。進捗を確認し、新しい指示で続行してください。" },
  de: { limit: "Das eingestellte Tool-Limit wurde erreicht. Ergebnisse sind gespeichert. Erhöhen oder deaktivieren Sie das Limit in den Unterhaltungseinstellungen und setzen Sie fort.", failures: "Nach 8 aufeinanderfolgenden Tool-Fehlern pausiert. Ergebnisse sind gespeichert. Prüfen Sie die Fehler und passen Sie Aufgabe oder Umgebung vor dem Fortsetzen an.", noProgress: "Nach 12 Tool-Aufrufen mit wiederholten Aktionen und Ergebnissen pausiert. Ergebnisse sind gespeichert. Prüfen Sie den Fortschritt und geben Sie neue Anweisungen." },
  pt_BR: { limit: "Pausado no limite de ferramentas definido por você. Os resultados foram salvos. Aumente ou desative o limite na configuração da conversa e continue.", failures: "Pausado após 8 falhas consecutivas de ferramentas. Os resultados foram salvos. Confira os erros e ajuste a tarefa ou o ambiente antes de continuar.", noProgress: "Pausado após 12 chamadas de ferramentas repetirem as mesmas ações e resultados. Os resultados foram salvos. Confira o progresso e envie novas instruções para continuar." }
};
export function agentErrorText(language: SupportedLanguage, error: unknown): string {
  const issue = readProviderIssue(error);
  if (issue) return providerReason(language, issue.kind);
  const detail = error instanceof Error ? error.message : String(error);
  const loopKey = /AGENT_STEP_LIMIT/.test(detail) ? "limit" : /AGENT_CONSECUTIVE_FAILURES/.test(detail) ? "failures" : /AGENT_NO_PROGRESS/.test(detail) ? "noProgress" : undefined;
  if (loopKey) return loopMessages[language][loopKey];
  const key = /CLAUDE_AUTH_REQUIRED/.test(detail) ? "auth" : /TIMEOUT|RUN_TIME_LIMIT/.test(detail) ? "timeout" : /CONTEXT_|MESSAGE_TOO_LARGE_FOR_MODEL/.test(detail) ? "context" : undefined;
  return key ? messages[language][key] : detail.slice(0, 1500);
}
