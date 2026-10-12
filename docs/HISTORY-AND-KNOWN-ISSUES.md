# Release history and open problems

**Status terminology:** Implemented = code exists. Mock-tested = Node tests passed. HAR-observed = protocol/behavior appeared in a capture. Live-verified = observed authenticated gameplay result. These are NOT interchangeable.

## Evolution

- v1.7.x: Breach/public lobby automation and market history. Rate-limit starvation and stale market estimates appeared in audits.
- v1.8.x: live inventory/equipment interpretation, resumable market scans and crafting/progression profiles.
- v1.9.0: affix targeting, native cleanup options, protection checks. Destructive cleanup still needs current-game validation.
- v1.10.0: fixed missing optimizer EQUIPMENT_EQUIP calls and broke uneconomic crafting attempts into affordability-aware plans. Mock verification did not guarantee live success.
- v1.11.0: protocol-oriented Breach, Contracts, Events.
- v2.0.0: governor, dashboard/icon family, IndexedDB history, adaptive equipment weights, enhancement budgets, Hardware/Homelab prioritization, changelog intelligence; subsequently found live failures.
- v2.0.1: isolated Brave/Playwright launch compatibility.
- v2.0.2: Control Center no longer targets itself as the active tab; improved error reporting and diagnostic bundle.
- v2.0.3: cooldown-aware equipment sends, partial optimizer failure messages, Breach repeat-refill rate repair, fresh-state rechecks for Contracts/Events, structured rate-limit classification.
- v2.0.4: Contracts/Events can run independently with Master disabled, and Enhancement dashboard explicitly exposes enabled and Dry Run toggles. **Live contract and craft outcomes remain unverified.**
- v2.0.5 (candidate): 112 granular Control Center settings, sample-based measured efficiency/stability/success, contract mutation confirmation against server state, automatic Enhancement passes only when explicitly enabled (30-minute spacing), 10-minute Breach relic-loadout deduplication, local save-state export/import and 15-minute checkpoints, optional Drive sync with consented OAuth. Node and isolated Chromium extension smoke tested; **no live game craft, contract mutation, or Google account sync claim yet.**

## Confirmed incidents from October 11–12 diagnostics

- 2.0.2 audit showed 148/155 inventory slots, eight equipped, a bridge connected, and meaningful candidates selected for five slots. Three EQUIPMENT_EQUIP operations were verified before the governor immediately deferred other equipment/lock operations. The UI previously reported only 3/8.
- The same audit showed BREACH_REFILL_REPEATS repeated on nearly every 15-second cycle while the run was active, and BREACH_STALE_VERSION. Contracts were briefly deferred by cooldown. 2.0.3 addressed these specific loops, pending live tests.
- User reported Contracts were not claimed/switched unless navigating to the Contract Board. **Root cause identified:** when Master Automation was off, the main loop ran only Breach (or Marketplace), so GET_CONTRACTS was not actively polled despite Contracts enabled. The board UI supplied a state event that woke the planner. v2.0.4 adds independent maintenance polling.
- User reports Enhancement not working. At least one audit recorded settings.enhance.enabled=false AND settings.enhance.dryRun=true. A manual enhancement action in that configuration only plans, and can also be blocked by 0 Stability or profile thresholds. The previous dashboard hid these controls. v2.0.4 exposes them, but craft decision/runtime behavior still needs inspection.
- User reports optimizer decisions not mathematically optimal. Current scoring uses heuristic affix/item weights and recent combat outcome indicators; it is **not** a validated global objective optimizer. Current combat sample hit rate ~85% versus configured 95% target, with some fights reporting zero hit-attempt samples; need determine exact metric accuracy and counterfactual testing.

## P0 unresolved: mandatory authenticated acceptance

1. Optimize all eight slots, verify actual equipped items after server responses, and compare selected loadout to explicit progression objective (XP/hour, win rate, survival, or credits/hour). Show confidence and rollback criteria.
2. Verify Contract GET_CONTRACTS and claim/set-active work **without visiting the Contract Board**, including daily reset, cooldown, and reconnect.
3. Verify live Enhancement when intentionally enabled with Dry Run off and sufficient resources; explain blocked reasons, budget spending and server ACKs. Do not turn on live spending without user approval.
4. Eliminate repeat-refill and stale-version Breach loops in actual gameplay. Verify ready/wipe/restart/prestige transitions and false rate-limit signals.
5. Give meaningful diagnostics for disabled, waiting, blocked, rate-limited and errored subsystems; do not conceal partial failure.
6. Confirm Chrome, Brave, isolated Playwright Brave and source-controlled release packaging.

## Additional limitations

- Current registered extension folders differ on the original machine; Git canonical source is extension/, so local deployment/migration must preserve extension IDs and storage.
- Hardware/Homelab state was false/unavailable in the latest audit, so automation cannot yet claim purchase outcomes.
- Resource Store purchase packets are not authoritatively captured and strategies are advisory.
- Crafting XP affix is not verified in the live game registry.
- Changelog parser can over-classify unrelated entries; needs dated concise summaries.
- Marketplace cleanup and trade automations need opt-in and authoritative results.
- Chrome extension upgrades do not automatically update files when changes land in Git; local installed unpacked paths need a safe reload/deploy workflow.
