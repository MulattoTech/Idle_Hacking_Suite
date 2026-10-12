# Idle Hacking Suite

**Idle Hacking Suite** is a Manifest V3 extension for [Idle Hacking](https://www.idlehacking.com/), targeting **Chrome, Brave, and other compatible Chromium browsers**. Its goal is reliable, observable gameplay automation with transparent decisions, conservative resource protection, and historical effectiveness measurement.

**Baseline:** v2.0.4 (October 2026). This is an active development baseline, **not a claim that every automation mode is live-verified**. See [known issues](docs/HISTORY-AND-KNOWN-ISSUES.md).

## Install as a browser extension

1. Open chrome://extensions or brave://extensions.
2. Enable Developer mode and choose Load unpacked.
3. Select the **extension/** folder in this repository (the folder containing manifest.json).
4. Open the game in the same browser profile, reload its tab, and open Idle Hacking Suite -> Control Center.
5. Start with non-destructive features and review diagnostics before enabling unattended crafting, purchasing, trading, or cleanup.

The extension is the primary runtime. An MCP server is **optional tooling** for live browser debugging, inspection, and Codex integration; it does not replace installed in-page automation by default. See [architecture](docs/ARCHITECTURE.md).

## Development

Use Node.js **24 LTS** (or another supported LTS version), then run:

    npm ci
    npm test

Tests cover Breach planning, cooldown/retry, state reconciliation, game tab routing, and static manifest references. They do not replace authenticated runtime tests.

The canonical source on the original development machine is **C:\Tools\Dev\IdleHacking**. Open this root folder in Codex Desktop, not a duplicate extracted extension release. Read [AGENTS.md](AGENTS.md) and [CODEX-HANDOFF.md](docs/CODEX-HANDOFF.md).

## Capture and browser inspection

- capture.js: segmented HAR, crash-resistant NDJSON, and NetLog using an isolated Brave profile.
- IdleHacking-Capture-GUI.ps1 and Launch IdleHacking Capture.vbs: local capture interface.
- merge-hars.js, journal-to-har.js, package-for-chatgpt.js: diagnostics processing.
- browser-mcp/: optional Microsoft Playwright MCP and a minimal read-only game-state inspector.

**Privacy:** real HARs, cookies, NetLogs, local browser profiles, runtime settings/logs, archives, and authentication material are excluded from this public repo. The capture tool can collect sensitive data if explicitly enabled; never publish it. See [security](docs/SECURITY.md).

## Project docs

- [Architecture](docs/ARCHITECTURE.md)
- [Known issues and release history](docs/HISTORY-AND-KNOWN-ISSUES.md)
- [Prioritized roadmap](docs/ROADMAP.md)
- [Codex handoff](docs/CODEX-HANDOFF.md)
- [Security and privacy](docs/SECURITY.md)

No open-source license has yet been selected.
