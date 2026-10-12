/**
 * Brave persistent-context compatibility helper for Idle Hacking Suite.
 *
 * Playwright normally supplies --disable-extensions.  That conflicts with
 * --load-extension and --disable-extensions-except.  Pass
 * ignoreDefaultArgs: ['--disable-extensions'] when launching this dedicated
 * profile.
 */
export function braveIdleHackingLaunchOptions({ braveExe, extensionDir }) {
  return {
    executablePath: braveExe,
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  };
}

/* Example:
import { chromium } from 'playwright';
import { braveIdleHackingLaunchOptions } from './playwright-brave-extension.js';

const context = await chromium.launchPersistentContext(
  'C:/Tools/Dev/IdleHacking/profile',
  braveIdleHackingLaunchOptions({
    braveExe: process.env.BRAVE_EXE || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    extensionDir: 'C:/Tools/Dev/IdleHacking/extension',
  }),
);
*/
