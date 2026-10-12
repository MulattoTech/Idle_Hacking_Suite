# Isolated Brave compatibility

Idle Hacking Suite 2.0.1 uses the same MV3 runtime in Chrome, normal Brave, and the dedicated Idle Hacking Brave profile.

## Why the isolated profile could fail to load the extension

The recorded automated Brave launch included all three of these flags at once:

- `--disable-extensions`
- `--disable-extensions-except=<Idle Hacking Suite>`
- `--load-extension=<Idle Hacking Suite>`

`--disable-extensions` conflicts with the two flags intended to load the unpacked extension.

## Direct launch

Run `Launch-Isolated-Brave.cmd` from the extension directory.  It defaults to:

- Brave: `%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`
- profile: `C:\\Tools\\Dev\\IdleHacking\\profile`
- extension: the folder containing the launcher
- URL: `https://www.idlehacking.com`

The launcher intentionally never supplies `--disable-extensions`.

## Playwright / HAR capture framework

When using `chromium.launchPersistentContext(...)`, retain the extension flags but explicitly remove Playwright's default extension-disabling argument:

```js
const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: braveExe,
  headless: false,
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
  ],
});
```

A reusable helper is included at `compat/playwright-brave-extension.js`.

## Release policy going forward

Future Idle Hacking Suite packages should preserve this compatibility requirement:

1. Never launch the dedicated Brave profile with `--disable-extensions`.
2. For Playwright persistent contexts, use `ignoreDefaultArgs: ['--disable-extensions']`.
3. Keep the extension itself on standard MV3 APIs that work in Chromium/Brave.
4. Verify Chrome/normal Brave compatibility separately from the isolated automated profile launcher.
