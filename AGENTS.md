# Codex agent instructions — Idle Hacking Suite

GitHub: MulattoTech/Idle_Hacking_Suite
Canonical local workspace: C:\Tools\Dev\IdleHacking
Product name: **Idle Hacking Suite**. Do not rename it.
Targets: Chrome, Brave, and Chromium MV3; optional MCP diagnostics.

## First actions

1. Read README.md and docs/CODEX-HANDOFF.md, docs/ARCHITECTURE.md, docs/HISTORY-AND-KNOWN-ISSUES.md, docs/ROADMAP.md.
2. Inspect git status, remotes, branches, and uncommitted changes. Preserve concurrent work.
3. Run npm test and node --check extension/page-bridge.js before modifying runtime code.
4. Work in a feature branch; create failing regression tests before each behavioral fix. Ground game packets in first-party protocol evidence.

## Guardrails

- The repository is PUBLIC. Never commit profile/, runtime/, captures/, ChatGPT Uploads/, backups, node_modules/, HAR/NetLog/NDJSON, .env files, session details, tokens, or cookies.
- Use synthetic or thoroughly sanitized fixtures; never embed raw auth data in tests.
- Preserve browser profiles and extension IDs. Do not clean or delete the user's captures.
- No live game account mutation during diagnosis without explicit authorization for that specific action. Destructive inventory decompilation and live marketplace purchases require explicit approval.
- Rate-limit-aware mutation governor must pace and verify actions. Never treat a rejected or deferred send as a successful operation.
- Prefer authoritative WebSocket state and native client capabilities over blind DOM guessing.
- Do not create another independently firing timer that can starve other automation.
- Keep canonical extension source in extension/. No nested extracted release copies as source of truth.
- Keep optional browser MCP strictly bounded to isolated localhost debugging; never expose a remote debugging port publicly.
- Avoid force pushes or merging incomplete/untested changes directly to main.

## Completion criteria

- Tests prove the targeted behavior, including failures and retry/rate-limit cases.
- Successful action requires verified authoritative state, not merely an outgoing packet.
- Extension integrity, UI feedback, browser compatibility, and error handling are checked.
- Document accurately what is implemented, simulated, or still unverified.
- Publish substantial work through a reviewable PR and supply a short handoff.
