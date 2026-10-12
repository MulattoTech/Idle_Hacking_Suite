# Dedicated Brave browser debugging (Playwright MCP)

Microsoft @playwright/mcp version 0.0.83 is installed under this folder. Codex CLI has MCP server **idlehacking-brave**, pointing at http://127.0.0.1:9358.

The pre-existing IdleHacking Capture GUI now has **Brave MCP: allow localhost debugging (9358)**. This option is enabled in the current GUI settings. Start a capture through the GUI to make the debugging endpoint available. The endpoint stops when you cleanly stop the capture.

To verify local browser introspection, run:

    node C:\Tools\Dev\IdleHacking\browser-mcp\inspect-game.cjs

This command prints a minimal live game summary and never requests tokens/cookies or raw WebSocket content. Desktop Commander can invoke it from ChatGPT. For interactive browser tools, a local Codex session can use the installed idlehacking-brave Playwright MCP server once the capture Brave session is open.

Check Codex registration:

    codex mcp get idlehacking-brave

**Important:** Local MCP registration does **not** automatically give the ChatGPT web conversation a native Playwright tool. ChatGPT can inspect the dedicated Brave session through the already connected Remote Desktop Commander bridge. The regular everyday Brave profile remains separate.

Security: CDP lets *any local program* that can connect to 127.0.0.1:9358 inspect and control the dedicated browser, including logged-in pages. This port is not bound to the LAN or public internet, is opt-in per capture session, and can be disabled by clearing the GUI checkbox. Only run trusted local software while this is enabled. Do not set up public tunnels to the port.

No recurring PowerShell or startup tasks are added. The existing hidden capture launcher remains the canonical launcher.
