# Privacy

WebAgentMate has no WebAgentMate-operated application server in this release.

- The extension reads a page only after the user requests page reading or starts an Agent task.
- The extracted page text and the user's prompt are sent directly to OrcaRouter to produce an answer.
- The OrcaRouter API key stays in Chrome local extension storage and is restricted to trusted extension contexts.
- When Bridge is installed, conversations are stored locally in SQLite on the user's computer. Bridge does not open a network port and does not store the Router key.
- WebAgentMate does not sell personal information or include analytics/advertising SDKs.
- In Agent mode, page controls and visible text are sent to the selected model to choose a constrained action. Clicks require user approval; sensitive targets are blocked.

Users can erase the Router key with **Disconnect**, delete Chrome extension data, and remove local conversation data by uninstalling Bridge and deleting its WebAgentMate data directory.
