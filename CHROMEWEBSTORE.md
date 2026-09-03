# Chrome Web Store submission notes

## Single purpose

WebAgentMate helps a user understand the webpage they are actively viewing and, after explicit confirmation, complete guarded page actions requested by the user.

## Permission justifications

- `sidePanel`: provides the primary assistant interface beside the page.
- `identity`: performs the user-initiated OrcaRouter OAuth 2.0 + PKCE flow.
- `storage`: stores language preference and the user's OrcaRouter credential locally.
- `nativeMessaging`: connects to the optional local Bridge for on-device conversation storage.
- `tabs`: identifies the active tab and obtains its title/URL when the user requests page reading.
- `scripting`: extracts visible text and identifies or operates visible controls after the user requests page reading or starts an Agent task. Click actions require confirmation.
- `http://*/*` and `https://*/*`: page-reading must work on user-selected pages across sites. Access is not used in the background, on restricted Chrome pages, or before explicit action.
- `https://www.orcarouter.ai/*`: starts and completes authorization.
- `https://api.orcarouter.ai/*`: verifies the connection and sends user-approved prompts/page context for inference.

## Remote code

No remote JavaScript or WebAssembly is executed. All extension code and UI libraries are included in the submitted package. Network responses are treated as data.

## Data handling

Web page text, selected text, URLs, visible control metadata, prompts, authentication information, and AI responses may be handled to provide the requested feature. WebAgentMate operates no application server in this release; inference data is sent directly to OrcaRouter. The project does not sell data or use it for advertising. See `PRIVACY.md`.

## Reviewer flow

1. Install and click the toolbar icon to open the side panel.
2. Click **Sign in with OrcaRouter** and complete authorization.
3. Open a normal HTTPS article and click **Read current page**.
4. Choose **Summarize** or submit a question.
5. Bridge is optional; without it, inference still works and the UI reports that local history is unavailable.

## Version history

- 0.2.1 — Added built-in Agent tasks, guarded webpage actions, user approval, cancellation, and system/light/dark themes.
- 0.1.1 — Added contextual OrcaRouter chat and optional local conversation storage.
