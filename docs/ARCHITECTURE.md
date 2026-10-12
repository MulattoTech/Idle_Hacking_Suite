# Idle Hacking Suite — Architecture

## Product boundary

Idle Hacking Suite is primarily a **Chromium Manifest V3 extension** for Chrome, Brave, and compatible browsers. It runs beside the logged-in Idle Hacking game page, and owns automation, user configuration, and historical telemetry. An optional local Playwright MCP provides browser inspection to Codex; it is not currently a replacement for persistent page automation.

**Canonical runtime source:** extension/. Other extracted 2.0.x folders in the original workspace are ignored historical/registered copies. Do not develop there.

## Runtime components

- extension/manifest.json loads MAIN-world and ISOLATED-world scripts, MV3 background service worker, popup, and Control Center.
- extension/page-bridge.js integrates the legacy game adapter/orchestrator. It observes the authenticated WebSocket; plans equipment/crafting actions; maintains state; and implements guarded commands. It is large and should be split carefully with tests, not rewritten blindly.
- extension/content.js handles extension messaging, in-game HUD, command correlation and historical market samples.
- extension/src/isolated/content-broker.js forwards state and telemetry into the background worker.
- extension/src/main/action-governor.js paces game actions; action-retry.js waits through cooldown windows; recheck-scheduler.js schedules fresh decisions for Contracts/Events; error-classifier.js separates structured error codes; maintenance-policy.js allows individually enabled Contracts/Events when Master is off.
- extension/src/main/engines/ contains strategy planners for Breach, Contracts, Events, combat, Hardware, Homelab, enhancement budgets, economy and marketplace.
- extension/src/background/ handles settings migration, IndexedDB, changelog intelligence and sanitized diagnostics.
- extension/src/ui/ houses quick popup and larger Control Center.
- extension/assets/ contains the extension icon family.

## Action lifecycle

1. Read authoritative game WebSocket state or request the documented state endpoint.
2. Select an eligible action and record an explainable decision.
3. Validate settings, target, resources, version, and destructive-action safeguards.
4. Wait for the governor's next allowed send window; do not confuse deferred actions with failed actions.
5. Send one command and observe authoritative acknowledgment/state, or a specific terminal error.
6. Verify expected mutation occurred, update telemetry, and re-evaluate from fresh state.

Sending a packet is not enough to claim success. Do not flood repeat actions; do not bypass the governor to improve apparent performance.

## Contracts behavior

Contracts must poll from the authenticated protocol with GET_CONTRACTS even when the user has not opened the Contract Board. Contract completion, claim, reconnection, a cooldown ending, and daily board revisions should trigger immediate reconciliation. Master OFF must not suppress independently enabled Contracts or Events. The current baseline contains a regression-tested scheduler for that case; it still requires live game validation.

## Enhancements

Enhancement defaults can be disabled and Dry Run can be on. Manual planning must not claim that resources were spent. Enabled/Dry Run states appear on the dashboard starting in v2.0.4. Affix strategy, budget ledgers and preview costs need live verification.

## Browser inspection

The local capture system in root capture.js uses an isolated Brave profile. Its optional CDP endpoint is localhost-only. Microsoft @playwright/mcp is installed separately under browser-mcp/ on the original machine; Codex CLI has a local MCP registration called idlehacking-brave. Only trusted local programs should have access. The browser port is off unless the capture GUI starts it.

## Persistence

IndexedDB keeps local telemetry and trend rollups. Browser profiles, HARs, NetLogs, NDJSON, logs, and backups are ignored; they never belong in the public repository.

## Technical debt

- page-bridge.js combines UI/DOM, WebSocket access, planning, and mutations.
- Several protocol wrappers still return booleans without comprehensive acknowledgment/result correlation.
- Breach stale-version and repeat-policy handling must be proven against latest first-party game behavior.
- Optimizer weights need quantitative combat-model validation and measured before/after confidence.
- Hardware/Homelab state is often missing from audits; direct Resource Store purchase protocol is unverified.
- End-to-end authorized Chrome/Brave tests are still needed.
