# vscode-yandex-tracker

VSCode and [Yandex.Tracker](https://yandex.ru/tracker/) integration

## Installation

Install extension from [Marketplace](https://marketplace.visualstudio.com/items?itemName=rusnasonov.vscode-yandex-tracker)

## Authorization

The extension uses cookie-based authentication for federated users.

### How to get cookies

1. Open [Yandex.Tracker](https://tracker.yandex.ru) in your browser
2. Login with your account
3. Open DevTools (F12) → Application → Cookies
4. Copy values of `Session_id`, `sessionid2`, and `yandexuid` cookies
5. Format them as: `Session_id=...;sessionid2=...;yandexuid=...`

### Setup in VS Code

1. Run command `Yandex.Tracker: Setup Cookie` in command palette (Ctrl+Shift+P)
2. Paste the cookie string
3. Reload window when prompted

Cookies are stored securely in VS Code SecretStorage.

## Features

### Sidebar

View your issues in the sidebar with color-coded priority indicators.

![Sidebar](https://github.com/rusnasonov/vscode-yandex-tracker/blob/master/resources/screenshots/sidebar.png)

Three filters available: `Assigned To Me`, `Followed By Me`, `Custom Query`.

`Custom Query` can be configured in Settings → `vscode-yandex-tracker.query`. See [Query Language](https://yandex.ru/tracker/support/user/query-filter.html).

### Issue Panel

Click on any issue to open a detailed view with:
- Issue description with markdown rendering
- Inline images
- Comments
- Status, priority, assignee info

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `vscode-yandex-tracker.host` | Tracker API host | `https://api.tracker.yandex.net/` |
| `vscode-yandex-tracker.query` | Custom query for third panel | `""` |