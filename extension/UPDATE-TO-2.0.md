# Upgrade to Idle Hacking Suite 2.0

## Recommended upgrade path

1. Back up your current unpacked extension folder if you want an easy rollback.
2. Extract the 2.0 package into the same unpacked-extension directory, replacing the old runtime files.
3. Open `chrome://extensions`.
4. Click **Reload** on Idle Hacking Suite.
5. Hard-refresh the Idle Hacking game tab.
6. Open the Suite popup and confirm it shows **Idle Hacking Suite 2.0** and **Connected**.
7. Open **Control Center** from the popup.

Existing supported settings are migrated to schema 200. Old Equalizer/Goal Resource settings are mapped to the new strategy terminology, but direct Resource Store purchasing remains disabled until its current protocol is captured.

## First-run recommendations

Start with **Balanced Autopilot**.

For Network Breach, verify:
- Breach enabled
- Autopilot enabled
- Always Ready enabled
- Repeat Starts configured
- Talent allocation = Server Auto (recommended) or Extension Strategy
- Auto Prestige enabled

If the game account does not expose server-native automatic talent allocation, the Suite falls back to its extension strategy rather than repeatedly sending an unavailable command.

For Enhancement, start with **Balanced** or **Cautious** Crafting Budget. Use Preserve if you specifically want to protect Hashes/Packets while observing decisions.

For Economy, enable automation only after you are comfortable with the selected spending personality. No arbitrary minimum-spend value is required.

## Diagnostics

If a subsystem does not act when expected:
1. Open Control Center → Diagnostics.
2. Export a Diagnostic Bundle immediately after the missed action.
3. Include a HAR from the same interval when possible.

Diagnostics v5 records the governor queue/cooldown, subsystem state, last decisions, and block reasons so missed behavior can usually be distinguished from an actual protocol failure.

## 2.0.1 isolated Brave compatibility

This package includes `Launch-Isolated-Brave.cmd` / `.ps1` and a Playwright helper.  The dedicated Idle Hacking Brave profile must not be launched with `--disable-extensions`; Playwright users should set `ignoreDefaultArgs: ['--disable-extensions']` while retaining `--load-extension` and `--disable-extensions-except`.
