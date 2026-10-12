# Idle Hacking Suite 2.0.3 — Governor/Breach Repair
October 11, 2026.

## Changes
- Optimizer's EQUIPMENT_EQUIP / ITEM_SET_DECOMPILE_LOCK actions wait for the governor's allowed send window instead of treating a cooldown as permanent failure.
- Governor exports nextDelayMs(), preserving global cooldowns and server retry-after limits.
- Optimizer reports incomplete slots as a failed command rather than claiming success with 3/8.
- Breach no longer attempts to refill repeated starts while a run or access phase is active. Lobby-only refills are throttled per unchanged session/counter for ten minutes.
- BREACH_STALE_VERSION triggers a throttled GET_BREACH_STATE refresh.
- Only structured server errors count as rate-limit signals. Hacking/other WS text containing the phrase 'rate limit' no longer triggers a false cooldown.
- Breach errors cannot be attributed to in-flight equipment commands.
- Contracts/Events schedule a single fresh-state re-evaluation after pacing/cooldown, rather than losing the activation request or replaying a stale packet.
- Diagnostics and UI live-tab routing fixes from 2.0.2 are retained.
- No marketplace automation or destructive cleanup settings were enabled or modified.

## Activation
This patch is installed in both existing registered Brave extension folders. Open brave://extensions, select Idle Hacking Suite, and click Reload. Then hard-refresh the game tab and Control Center. Saved extension identity and storage are retained.

## Verified
Run Node regression tests stored at C:\Tools\Dev\IdleHacking\_repair_backup\v2-0-3-regression.test.cjs. JavaScript/manifest references should also pass structural verification.

## Live limits
Tests and the saved diagnostic validate the protocol/planner behavior, but a real 8/8 live equip outcome still requires testing in your logged-in Brave session. When the GUI capture session is started with Brave MCP enabled, localhost inspection is available; see browser-mcp/README.md.
