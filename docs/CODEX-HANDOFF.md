# Codex handoff — 2026-10-11

**Project**: Idle Hacking Suite
**Repo**: https://github.com/MulattoTech/Idle_Hacking_Suite
**Local**: C:\Tools\Dev\IdleHacking
**Target**: Chromium MV3 extension (Chrome/Brave) with optional local Playwright MCP diagnostic companion.
**Starting model**: GPT-6 Luna Medium via Codex Desktop.

## Verify the baseline

- The repo was previously empty. The local folder was not a Git repository before synchronization. Use this root as the canonical Git working tree.
- Runtime extension is in extension/; original machine has duplicate extracted extension folders registered to different Brave profiles. Never delete or overwrite profiles/storage to "consolidate" them.
- Test with npm test; inspect git status and branch, then read AGENTS.md.
- Local browser MCP registration is idlehacking-brave in Codex; requires dedicated Brave Capture GUI running with Brave MCP checked. If offline, do not assume MCP can inspect game.
- The v2.0.4 maintenance/UI changes are syntactically and unit tested but NOT yet live game verified.

## Top reproducible bugs

1. **Contracts only seem to accept/switch after opening board**. A recent audit showed Master Automation OFF, Contracts ON, and Breach autopilot ON. Legacy scheduler skipped Contracts while Master OFF. New independent loop issues GET_CONTRACTS without UI navigation. Confirm observed outgoing query + CONTRACTS_STATE/claim and active change in actual game, including reset. Fix any remaining server or scheduler blockers.
2. **Enhancement doesn't modify items**. Audit had enhancement.enabled=false and dryRun=true; manual dry run can print plans but won't mutate. Some items have 0 Stability; others blocked by policy. v2.0.4 Control Center exposes both settings; inspect live request/response and UI feedback. Do not automatically enable spending.
3. **Optimizer not mathematically optimal**. Current heuristic can select higher raw-score gear with only +1% gain while the actual combat goal might be XP/hour or sustainable streak. Need objective-based optimization, actual first-party stat scaling and controlled post-change data, not arbitrary weights. Audit combat hit rate ~85-87%, win rate ~93%, 40+ rounds/fight; sample hit attempts sometimes zero. Verify metric extraction before trusting it.
4. **Breach**. Audit had repeated BREACH_REFILL_REPEATS every 15 seconds and BREACH_STALE_VERSION. v2.0.3 throttles refill to lobby and requests state on stale errors; verify live, including ready/wipe/restart/prestige.
5. **Governor**. Earlier audit showed only 3/8 equip actions completed because others were deferred, not denied. v2.0.3 added wait-through-cooldown, but authenticate 8/8 outcome.
6. **Hardware/Homelab, Events**. Latest audit had no hardware/homelab state. Events optedIn false with no current event. Treat unverified instead of broken until availability and current protocol are established.

## Engineering workflow

- Protect user's existing session: start with read-only inspection and small synthetic regression fixtures. Do not run purchases, destructive actions or experimental live writes without authorization.
- Use isolated development branches; tests first; avoid restructuring everything at once.
- Inspect official first-party JS in HAR capture carefully, but never check in raw HARs, credentials or session cookies.
- Connect using @playwright/mcp or existing Remote Desktop Commander only to the dedicated 127.0.0.1:9358 port if opt-in capture is active. Never expose it publicly.
- Prioritize observable, small, backward-compatible changes with proof of state transitions and benchmark measurements.
- Publish a reviewable PR with screenshots and tests when feasible. Do not force-push to main.

## Desired handoff output after each run

- Implemented vs tested vs live-verified, each separately labeled
- Changed files and commit SHA / branch / PR URL
- Unit test results + browser smoke/trace evidence
- Known blockers and next exact action
- Performance impact measured, with request volume and rate-limit counts
