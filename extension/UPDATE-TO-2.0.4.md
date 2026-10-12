# v2.0.4 — Contracts/Events maintenance and visible Enhancement mode

- Independent Contracts/Events maintenance when Master Automation is disabled but the corresponding subsystem remains enabled. This prevents a missing GET_CONTRACTS refresh until the user manually opens the Contract Board.
- Adds Control Center toggles for **Automatic Enhancement** and **Dry Run (no spending)**. Previous saved settings remain intact.
- Doesn't auto-enable live crafting. The user must explicitly disable Dry Run and choose to save the setting before any manual live enhancement work could spend resources.
- Tested the scheduler settings policy and dashboard controls with Node. Authenticated in-game Contract switching/Enhancement mutation still require validation.
- Retains 2.0.3 rate-limit/governor, Breach repeat/spam, and 2.0.2 tab-routing fixes.

Installed extension copies may be registered in different paths for regular Brave and isolated Playwright Brave. Do not delete/recreate extensions while syncing; preserve their storage/IDs. This Git source folder extension/ is canonical. See docs/CODEX-HANDOFF.md for next steps.
