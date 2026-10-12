# Security, privacy and automation safety

This is a PUBLIC GitHub repository. Never commit/upload:

- Browser profiles, cookies, Login Data, extensions' local storage, tokens, auth/session information
- HAR/NetLog/NDJSON capture files, uploaded diagnostic ZIPs, raw application logs
- Local runtime settings, personal directories and machine backups
- Arbitrage purchase credentials or private APIs

The .gitignore protects known folders, but does not replace verifying git diff --cached before every push.

## Browser debugging

The optional Brave CDP port 9358 is bound to 127.0.0.1 and opt-in from the capture GUI. It provides **full browser control to any local process** that can connect. Run trusted applications only. Do not open public tunnels, port-forward, or expose on the LAN. A locally running ChatGPT/Codex MCP client still inherits the privileges of the user/Brave profile.

Brave capture can intentionally collect sensitive data, particularly when IncludeSensitive NetLog is ON. Share only sanitized summaries by default. Keep raw captures local and excluded from version control.

## Gameplay safeguards

- Do not decompile, sell, list, purchase, prestige, or spend scarce crafting resources merely to test a code path.
- Require explicit opt-in and a dry-run/preview for destructive or costly operations.
- Version-stamped Breach actions must honor authoritative game state and current session version.
- Always verify equipment changes, resource consumption, market settlement and contract state from the server.
- Respect rate limiting; never evade or bypass the game's rate limits.
- Don't falsely mark unverified actions as successful in the UI or diagnostics.

## Disclosure / reporting

Do not include live cookies, access tokens, emails, device identifiers, account IDs or proprietary first-party game script copies in public issues or PRs. Prefer high-level protocol schemas, test fixtures with invented IDs and source-independent regression cases.
