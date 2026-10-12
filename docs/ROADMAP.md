# Engineering roadmap — Idle Hacking Suite

## P0 — Fix live reliability before expanding scope

- [ ] **Contracts without opening board:** verify GET_CONTRACTS is periodically sent and CONTRACT_CLAIM / CONTRACT_SET_ACTIVE are acknowledged when Master is off and Contracts on. Test a board rollover/reconnect, cooldown, and disabled setting. Add explicit UI state.
- [ ] **Enhancement:** show when disabled or in Dry Run. Capture per-item crafting preview, Stability, affordability, action result and spent resources. Only execute spending after explicit user confirmation and enforce budget limits.
- [ ] **Optimizer:** define selectable explicit objectives (XP/hour, combat wins/hour, sustainable streak, credits/hour, composite), benchmark scoring against live equipment/affixes, model trade-offs and uncertainty. Confirm complete equip and item locks, not just planned IDs; measure before/after using comparable zones/enemies.
- [ ] **Shared governor:** further unify deferred sends and ensure actions are eventually retried or reported terminally; fair priorities, verified ACKs, cancellation, and stale-version recovery.
- [ ] **Breach AFK:** prove joining, ready persistence, repeat refill suppression, recompile/prestige and correct leaderboard/lobby selection against current client. No repeated commands during active runs.
- [ ] **Browser + CI:** run Chrome, standard Brave and isolated Brave smoke tests. Fail build on missing runtime references, JS syntax errors, UI IDs, leaked secrets, or broken regression tests.
- [ ] **User feedback:** replace vague Needs Input/Completed with precise state and next-action reasoning.

## P1 — Maintainability and actual progression optimization

- [ ] Split large page-bridge.js into modules with separate protocol adapters and pure planners; preserve injection order and storage.
- [ ] Verify current Hardware/Homelab GET/UPGRADE messages and live marginal-value score. No arbitrary minimum-spend.
- [ ] Expand enhancement profiles, per-resource slider/limits, saved build priorities and actionable cost receipts.
- [ ] Better Contract ranking by observed completion time, reward / time, player role and reset horizon.
- [ ] Improve combat telemetry accuracy and confidence intervals, use reproducible A/B equipment trials, avoid invented precision.
- [ ] Simplify UI while keeping deep settings, accessible tooltips, copyable reasons and useful effectiveness charts.
- [ ] Changelog digest: date-aware, new/high-impact-only and relevant to extension behavior.
- [ ] IndexedDB schema / retention / sanitized analytics export.

## P2 — Evaluate improvements to architecture

- [ ] Confirm Resource Store purchase protocol before enabling direct purchases.
- [ ] Marketplace valuation and arbitrage after transaction settlement can be verified and safeguards proven.
- [ ] Investigate optional desktop supervisor / Playwright or ChatGPT/Codex MCP, but retain Chrome/Brave/Chromium MV3 extension for persistent lightweight automation unless a better architecture proves substantial benefit.
- [ ] Deterministic releases, checksums, updater/deployment tool preserving registered extension identity and local profiles.

## Acceptance bar

1. No unapproved destructive/trading/spending changes.
2. Contract Board need not be visible for contract progress and switching.
3. One optimizer pass verifies 8/8 kept or changed items, or outputs exact recoverable errors.
4. Breach doesn't spam repeat refills or stale-version commands.
5. No packet/operation is called "successful" without authoritative verification.
6. Tests + smoke evidence and performance measurements, not only static mocks.
