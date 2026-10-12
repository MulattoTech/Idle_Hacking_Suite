# Idle Hacking Suite 2.0 — Astra Control Center

Idle Hacking Suite 2.0 is a Chrome Manifest V3 automation and analytics control plane for Idle Hacking. Version 2.0 replaces the old collection of mostly independent timers with one rate-limit-aware governor, adds durable historical telemetry, rebuilds Network Breach for unattended play, and separates quick controls from a full Control Center dashboard.

## What changed in 2.0

### One Action Governor
All Suite-generated actions now share one priority/cooldown layer. Urgent gameplay work such as a Breach ready check, event participation, or contract reconciliation outranks background marketplace scanning. Rate-limit responses cause centralized cooldown/backoff instead of multiple subsystems immediately retrying independently.

### Control Center UI
The extension now has two surfaces:

- **Popup:** quick connection/status view, preset selector, master toggle, Optimize, Breach, pause/resume, diagnostics.
- **Control Center:** Overview, Equipment, Breach, Progression, Economy, Market, Intelligence, and Diagnostics.

The UI provides status chips, inline explanations, tooltips, decision reasons, effectiveness metrics, and a dedicated dark/cyan/violet icon family.

### Network Breach 2.0
Breach automation is state-driven rather than page-click driven. Depending on live state and settings it can:

- discover and join the best eligible public lobby;
- automatically choose an eligible class when class is set to Auto;
- keep `ready` and `ready_for_multiple` asserted after lobby transitions and wipes;
- configure repeat starts and refill repeat starts;
- continue after supported token wipes;
- use the game's current server-native talent auto-allocation when available;
- fall back to the Suite's registry-driven talent allocation when native auto-allocation is unavailable;
- optimize owned Breach relic loadouts;
- maintain crawl/movement policy;
- start a run when the player is leader and requirements are met;
- prestige at the exact current recompile requirement;
- allocate Prestige stars using Adaptive, Class-themed, Integrity, or Hold policy.

The first-party server auto-talent feature may require the game's Premium entitlement. The extension fallback does not depend on that server feature.

### Contracts and Events
Contracts and Community Events use authoritative protocol/state rather than relying on currently visible DOM buttons.

Contracts now reconcile immediately after completion/claim/state changes and detect board resets. They can claim completed contracts, activate the next contract, and switch to a materially better or role-aligned contract. A lower-frequency poll remains only as recovery.

Events can request status, opt into the selected role, and switch roles when allowed. UI `Gatherer` maps to the game's `gathering` protocol role.

### Adaptive equipment optimization
Optimizer decisions now include recent hacking evidence rather than only a static item score. Combat telemetry tracks signals such as hit success, victories, survival, fight length, damage pressure, and streak behavior. The advisor can increase Accuracy weight when hit rate is weak, increase defensive weight when survivability is poor, or favor offense when fights are stable but slow.

A post-optimization evidence comparison is retained. If measured performance materially degrades after a gear change, the previous winner set receives a temporary score penalty and the next optimization pass can recommend rollback/re-optimization rather than defending the last decision indefinitely.

### Intelligent enhancement budgets
Enhancement profiles now share a resource-budget layer with five personalities:

- Preserve
- Cautious
- Balanced
- Aggressive
- Burn It

The budget applies live resource reserves plus per-item, per-pass, and per-hour spending limits. It uses the game's current crafting preview/cost state and records why an action is blocked. This prevents Hashes, Packets, Cycles, Snippets, Stabilizers, or Credits from being drained simply because another reroll is technically possible.

### Hardware and Homelab economy automation
Hardware and Homelab automation no longer require an arbitrary minimum-spend setting. The Suite evaluates legal live upgrades/jobs by marginal progression utility versus constrained resources, applies the selected spending personality/reserves, respects Homelab dependencies and build slots, and can include adaptive combat bottlenecks in Hardware priorities.

### Resource Strategy — important limitation
The new Resource Strategy modes are:

- Bottleneck Balancer
- Target Reserve
- Progression Priority

In 2.0 these are **cross-system strategy signals** for other automation. The September 17 short capture did not contain a verified current direct Resource Store purchase protocol. Therefore 2.0 deliberately does **not** pretend these new strategies can buy directly from that store or silently map them to the legacy Equalizer/Goal DOM controls. Legacy Equalizer/Goal settings remain compatibility-only.

Once a capture contains the current Resource Store purchase protocol/state, direct store purchasing can be implemented without guessing.

### Marketplace scheduling
The v1.x completed-sale/live-comparable valuation safeguards are preserved. Marketplace scanning is resumable and governed as background work so it yields to urgent Breach, Events, Contracts, and other higher-priority actions rather than monopolizing an automation cycle.

### Changelog Intelligence
The current HAR exposed the game's changelog endpoint but not its response body. At runtime, 2.0 fetches the game's own `/content/changelog`, parses/fingerprints entries, stores seen state locally, and surfaces unseen/high-impact changes in the Intelligence view. If the source format changes beyond recognition, the parser reports failure rather than fabricating notes.

### Historical effectiveness
IndexedDB stores durable local telemetry for combat, decisions, equipment changes, enhancement spend, Breach runs, contracts, events, market activity, economy purchases, and changelog entries. The Intelligence view compares current and previous periods and exposes the components behind its combat-efficiency score instead of hiding behavior behind an opaque number.

### Diagnostics v5
Diagnostics now include governor state, adaptive combat evidence, optimizer before/after outcome, enhancement-budget usage, economy recommendation, Breach/Contracts/Event state, and recent action traces. Export sanitization removes credential-shaped fields by default.

## Automation presets

**Safe AFK** preserves larger resource reserves and avoids aggressive/risky spending.

**Balanced Autopilot** is the default compromise between unattended progression and resource preservation.

**Maximum Progression** accepts lower reserves and more aggressive progression spending.

Every major subsystem remains individually configurable.

## What 2.0 intentionally does not claim

- It does not claim a mathematically proven globally optimal combat build; decisions are evidence-driven heuristics using observable game state and outcomes.
- Direct current Resource Store buying is not implemented without a verified protocol capture.
- The changelog parser cannot be guaranteed against a future undocumented markup change; it fails visibly and retains last-known data.
- Server-native Breach talent auto-allocation may depend on an in-game Premium entitlement; Suite fallback allocation remains available.

## Privacy and capture handling

The extension's diagnostic exporter is designed to omit or redact credential-shaped data. Raw HAR captures used for development may contain browser/session material; 2.0 does not import those credentials into telemetry.
