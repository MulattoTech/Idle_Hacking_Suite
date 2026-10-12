'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
const ROOT = __dirname;
const BRAVE_EXE = process.env.BRAVE_EXE || path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || process.env.HOME || '', 'AppData', 'Local'), 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
const EXTENSION_DIR = process.env.EXTENSION_DIR || path.join(ROOT, 'extension');
const PROFILE_DIR = process.env.PROFILE_DIR || path.join(ROOT, 'profile');
const TARGET_URL = process.env.TARGET_URL || 'https://www.idlehacking.com';
const cdpCandidate = Number(process.env.IHS_BRAVE_CDP_PORT || 0);
const BRAVE_CDP_PORT = Number.isInteger(cdpCandidate) && cdpCandidate >= 1024 && cdpCandidate <= 65535 ? cdpCandidate : 0;

// A short segment limits how much HAR data can be lost if Brave is killed.
const HAR_SEGMENT_MS = Math.max(10_000, Number(process.env.HAR_SEGMENT_MS || 60_000));

// The streaming journal is the crash-resistant fallback.
const CAPTURE_BODIES = process.env.CAPTURE_BODIES !== '0';
const CAPTURE_ALL_BODIES = process.env.CAPTURE_ALL_BODIES === '1';
const MAX_BODY_BYTES = Math.max(0, Number(process.env.MAX_BODY_BYTES || 4 * 1024 * 1024));

// Chromium NetLog is an independent browser-level safety net.
// WARNING: IncludeSensitive can contain auth/cookie/session data.
const NETLOG_MODE = process.env.NETLOG_MODE || 'IncludeSensitive';
const NETLOG_MAX_MB = Math.max(1, Number(process.env.NETLOG_MAX_MB || 512));
const AUTO_MERGE = process.env.AUTO_MERGE !== '0';

// Keep a complete session around the requested upload-friendly ceiling. We
// begin a clean stop slightly before the configured budget to leave room for
// final HAR/NetLog writes during shutdown.
const CAPTURE_BUDGET_MB = Math.max(50, Number(process.env.CAPTURE_BUDGET_MB || 450));
const CAPTURE_WARN_MB = Math.max(
  1,
  Math.min(CAPTURE_BUDGET_MB - 1, Number(process.env.CAPTURE_WARN_MB || Math.max(1, CAPTURE_BUDGET_MB - 50))),
);
const CAPTURE_STOP_HEADROOM_MB = Math.max(
  1,
  Math.min(50, Number(process.env.CAPTURE_STOP_HEADROOM_MB || 10)),
);
const CAPTURE_STOP_AT_MB = Math.max(
  CAPTURE_WARN_MB,
  CAPTURE_BUDGET_MB - CAPTURE_STOP_HEADROOM_MB,
);
const CAPTURE_SIZE_CHECK_MS = Math.max(250, Number(process.env.CAPTURE_SIZE_CHECK_MS || 1000));
const AUTO_PACKAGE_CHATGPT = process.env.AUTO_PACKAGE_CHATGPT !== '0';
const CHATGPT_ZIP_PART_MB = Math.max(1, Math.min(430, Number(process.env.CHATGPT_ZIP_PART_MB || 430)));
const MIB = 1024 * 1024;

const RUNTIME_DIR = path.join(ROOT, 'runtime');
const STATE_PATH = path.join(RUNTIME_DIR, 'capture-state.json');
const LOG_PATH = path.join(RUNTIME_DIR, 'capture.log');
const STOP_REQUEST_PATH = path.join(RUNTIME_DIR, 'stop.request');
const LOCK_PATH = path.join(RUNTIME_DIR, 'capture.lock');
fs.mkdirSync(RUNTIME_DIR, { recursive: true });

const nativeConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function appendRuntimeLog(level, args) {
  try {
    const text = args.map(value => {
      if (value instanceof Error) return value.stack || value.message;
      if (typeof value === 'string') return value;
      try { return JSON.stringify(value); } catch { return String(value); }
    }).join(' ');
    fs.appendFileSync(LOG_PATH, `${new Date().toISOString()} [${level}] ${text}\n`, 'utf8');
  } catch {}
}

let currentState = {};
function writeState(patch = {}) {
  currentState = { ...currentState, ...patch, updatedAt: new Date().toISOString() };
  try {
    const temp = `${STATE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(currentState, null, 2), 'utf8');
    fs.renameSync(temp, STATE_PATH);
  } catch (error) {
    appendRuntimeLog('WARN', [`Could not update state: ${error.message}`]);
  }
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

function acquireLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      const oldPid = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
      if (isPidRunning(oldPid)) {
        throw new Error(`Another capture process is already running (PID ${oldPid}).`);
      }
      fs.rmSync(LOCK_PATH, { force: true });
    }
    fs.writeFileSync(LOCK_PATH, String(process.pid), { flag: 'wx' });
  } catch (error) {
    throw new Error(`Unable to acquire capture lock: ${error.message}`);
  }
}

function releaseLock() {
  try {
    if (!fs.existsSync(LOCK_PATH)) return;
    const owner = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
    if (owner === process.pid) fs.rmSync(LOCK_PATH, { force: true });
  } catch {}
}

try {
  acquireLock();
} catch (error) {
  nativeConsole.error(error.message);
  process.exit(3);
}
process.once('exit', releaseLock);

try { fs.writeFileSync(LOG_PATH, '', 'utf8'); } catch {}
console.log = (...args) => { nativeConsole.log(...args); appendRuntimeLog('INFO', args); };
console.warn = (...args) => { nativeConsole.warn(...args); appendRuntimeLog('WARN', args); };
console.error = (...args) => { nativeConsole.error(...args); appendRuntimeLog('ERROR', args); };

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const CAPTURE_DIR = path.join(ROOT, 'captures', stamp);
const JOURNAL_PATH = path.join(CAPTURE_DIR, 'network.ndjson');
const NETLOG_PATH = path.join(CAPTURE_DIR, 'netlog.json');
const META_PATH = path.join(CAPTURE_DIR, 'session.json');

fs.mkdirSync(CAPTURE_DIR, { recursive: true });

writeState({
  status: 'initializing',
  pid: process.pid,
  startedAt: new Date().toISOString(),
  captureDir: CAPTURE_DIR,
  targetUrl: TARGET_URL,
  harSegmentMs: HAR_SEGMENT_MS,
  autoMerge: AUTO_MERGE,
  autoPackageChatGPT: AUTO_PACKAGE_CHATGPT,
  captureBudgetMb: CAPTURE_BUDGET_MB,
  captureWarnMb: CAPTURE_WARN_MB,
  captureStopAtMb: CAPTURE_STOP_AT_MB,
  chatGPTZipPartMb: CHATGPT_ZIP_PART_MB,
  netLogMode: NETLOG_MODE,
});

function assertExists(fileOrDir, label) {
  if (!fs.existsSync(fileOrDir)) {
    throw new Error(`${label} not found: ${fileOrDir}`);
  }
}

assertExists(BRAVE_EXE, 'Brave executable');
assertExists(EXTENSION_DIR, 'Extension directory');
assertExists(path.join(EXTENSION_DIR, 'manifest.json'), 'Extension manifest');
fs.mkdirSync(PROFILE_DIR, { recursive: true });

let playwrightVersion = 'unknown';
try {
  playwrightVersion = require('playwright/package.json').version;
} catch {
  // Non-fatal. Feature detection below is authoritative.
}

fs.writeFileSync(
  META_PATH,
  JSON.stringify(
    {
      startedAt: new Date().toISOString(),
      node: process.version,
      playwright: playwrightVersion,
      braveExecutable: BRAVE_EXE,
      extensionDir: EXTENSION_DIR,
      profileDir: PROFILE_DIR,
      targetUrl: TARGET_URL,
      harSegmentMs: HAR_SEGMENT_MS,
      captureBodies: CAPTURE_BODIES,
      captureAllBodies: CAPTURE_ALL_BODIES,
      maxBodyBytes: MAX_BODY_BYTES,
      netLogMode: NETLOG_MODE,
      netLogMaxMb: NETLOG_MAX_MB,
      captureBudgetMb: CAPTURE_BUDGET_MB,
      captureWarnMb: CAPTURE_WARN_MB,
      captureStopHeadroomMb: CAPTURE_STOP_HEADROOM_MB,
      captureStopAtMb: CAPTURE_STOP_AT_MB,
      autoPackageChatGPT: AUTO_PACKAGE_CHATGPT,
      chatGPTZipPartMb: CHATGPT_ZIP_PART_MB,
    },
    null,
    2,
  ),
);

// -----------------------------------------------------------------------------
// Crash-resistant newline-delimited JSON writer.
// fs.writeSync puts each event into the file immediately; fsync every ~1 second
// bounds what could remain only in the OS cache during a hard kill/power loss.
// -----------------------------------------------------------------------------
let journalFd = fs.openSync(JOURNAL_PATH, 'a');
let lastFsync = 0;
let linesSinceFsync = 0;

function fsyncJournal(force = false) {
  if (journalFd === null) return;
  const now = Date.now();
  if (!force && linesSinceFsync < 25 && now - lastFsync < 1000) return;
  try {
    fs.fsyncSync(journalFd);
    lastFsync = now;
    linesSinceFsync = 0;
  } catch {
    // Best effort only; a later write or shutdown will try again.
  }
}

function journal(type, data = {}) {
  if (journalFd === null) return;
  try {
    const record = JSON.stringify({
      ts: new Date().toISOString(),
      type,
      ...data,
    });
    fs.writeSync(journalFd, `${record}\n`, null, 'utf8');
    linesSinceFsync += 1;
    fsyncJournal(false);
  } catch (error) {
    // Do not let logging failure take down the capture process.
    try {
      console.error('[journal] write failed:', error.message);
    } catch {}
  }
}

const fsyncTimer = setInterval(() => fsyncJournal(true), 1000);
fsyncTimer.unref();

function closeJournal() {
  if (journalFd === null) return;
  try {
    fsyncJournal(true);
    fs.closeSync(journalFd);
  } catch {}
  journalFd = null;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function encodePayload(payload) {
  if (Buffer.isBuffer(payload)) {
    return { encoding: 'base64', data: payload.toString('base64') };
  }
  return { encoding: 'utf8', data: String(payload) };
}

function safeFrameUrl(request) {
  try {
    if (request.serviceWorker()) return null;
    return request.frame().url();
  } catch {
    return null;
  }
}

function safeServiceWorkerUrl(request) {
  try {
    return request.serviceWorker()?.url() || null;
  } catch {
    return null;
  }
}

function shouldCaptureBody(contentType, byteLength) {
  if (!CAPTURE_BODIES) return false;
  if (byteLength > MAX_BODY_BYTES) return false;
  if (CAPTURE_ALL_BODIES) return true;
  return /(^text\/)|json|javascript|xml|graphql|protobuf|msgpack|octet-stream/i.test(
    contentType || '',
  );
}

function withTimeout(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}


function directorySizeBytes(dir) {
  let total = 0;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) total += directorySizeBytes(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    } catch {}
  }
  return total;
}

function trafficHarBytes(dir) {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/^traffic-\d+\.har$/i.test(entry.name)) continue;
      try { total += fs.statSync(path.join(dir, entry.name)).size; } catch {}
    }
  } catch {}
  return total;
}

function bytesToMiB(bytes) {
  return Math.round((bytes / MIB) * 100) / 100;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
let context;
let contextClosed = false;
let shuttingDown = false;
let shutdownPromise = null;
let harActive = false;
let harSegment = 0;
let harTimer = null;
let stopRequestTimer = null;
let captureSizeTimer = null;
let captureWarned = false;
let budgetStopTriggered = false;
let harQueue = Promise.resolve();
let resolveDone;
const done = new Promise(resolve => {
  resolveDone = resolve;
});

const requestIds = new WeakMap();
let nextRequestId = 1;
let nextSocketId = 1;

function requestId(request) {
  let id = requestIds.get(request);
  if (!id) {
    id = `r${nextRequestId++}`;
    requestIds.set(request, id);
  }
  return id;
}

async function startHarSegment() {
  if (shuttingDown || contextClosed || !context) return;
  if (typeof context.tracing?.startHar !== 'function') return;

  harSegment += 1;
  const harPath = path.join(
    CAPTURE_DIR,
    `traffic-${String(harSegment).padStart(5, '0')}.har`,
  );

  await context.tracing.startHar(harPath, {
    content: 'embed',
    mode: 'full',
  });
  harActive = true;
  writeState({ status: 'running', harSegment, currentHar: harPath });
  journal('har-segment-start', { segment: harSegment, path: harPath });
  console.log(`[HAR] segment ${harSegment} recording -> ${harPath}`);
}

async function stopHarSegment(reason) {
  if (!harActive || !context || typeof context.tracing?.stopHar !== 'function') return;
  try {
    await context.tracing.stopHar();
    journal('har-segment-stop', { segment: harSegment, reason, finalized: true });
    console.log(`[HAR] segment ${harSegment} finalized (${reason})`);
  } catch (error) {
    journal('har-segment-stop', {
      segment: harSegment,
      reason,
      finalized: false,
      error: error.message,
    });
    console.error(`[HAR] segment ${harSegment} could not finalize: ${error.message}`);
  } finally {
    harActive = false;
    writeState({ harSegment, currentHar: null });
  }
}

function queueHarRotation(reason = 'timer') {
  harQueue = harQueue
    .then(async () => {
      if (shuttingDown || contextClosed) return;
      await stopHarSegment(reason);
      if (!shuttingDown && !contextClosed) await startHarSegment();
    })
    .catch(error => {
      journal('har-rotation-error', { reason, error: error.message });
      console.error('[HAR] rotation error:', error.message);
    });
  return harQueue;
}

function attachPage(page) {
  const pageTag = `p${Math.random().toString(36).slice(2, 10)}`;
  journal('page-open', { pageTag, url: page.url() });

  page.on('websocket', ws => {
    const socketId = `ws${nextSocketId++}`;
    journal('websocket-open', { socketId, pageTag, url: ws.url() });

    ws.on('framesent', event => {
      journal('websocket-frame-sent', {
        socketId,
        ...encodePayload(event.payload),
      });
    });

    ws.on('framereceived', event => {
      journal('websocket-frame-received', {
        socketId,
        ...encodePayload(event.payload),
      });
    });

    ws.on('socketerror', error => {
      journal('websocket-error', { socketId, error: String(error) });
    });

    ws.on('close', () => {
      journal('websocket-close', { socketId });
    });
  });

  page.on('close', () => journal('page-close', { pageTag, url: page.url() }));
}

function attachContextNetworkLogging(ctx) {
  ctx.on('request', request => {
    journal('request', {
      requestId: requestId(request),
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      isNavigationRequest: request.isNavigationRequest(),
      frameUrl: safeFrameUrl(request),
      serviceWorkerUrl: safeServiceWorkerUrl(request),
      headers: request.headers(),
      postData: request.postData(),
    });
  });

  ctx.on('response', response => {
    const request = response.request();
    journal('response', {
      requestId: requestId(request),
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      fromServiceWorker: response.fromServiceWorker(),
    });
  });

  ctx.on('requestfailed', request => {
    journal('request-failed', {
      requestId: requestId(request),
      url: request.url(),
      failure: request.failure(),
    });
  });

  ctx.on('requestfinished', request => {
    const id = requestId(request);
    journal('request-finished', { requestId: id, url: request.url() });

    if (!CAPTURE_BODIES) return;

    void (async () => {
      try {
        const response = await request.response();
        if (!response) return;

        const headers = response.headers();
        const contentType = headers['content-type'] || '';
        const body = await response.body();
        if (!shouldCaptureBody(contentType, body.length)) {
          journal('response-body-skipped', {
            requestId: id,
            contentType,
            bytes: body.length,
          });
          return;
        }

        journal('response-body', {
          requestId: id,
          contentType,
          bytes: body.length,
          encoding: 'base64',
          data: body.toString('base64'),
        });
      } catch (error) {
        journal('response-body-error', { requestId: id, error: error.message });
      }
    })();
  });

  ctx.on('page', attachPage);
  for (const page of ctx.pages()) attachPage(page);

  ctx.on('serviceworker', worker => {
    journal('serviceworker', { url: worker.url() });
  });

  for (const worker of ctx.serviceWorkers()) {
    journal('serviceworker-existing', { url: worker.url() });
  }
}

function checkCaptureSize() {
  if (shuttingDown || budgetStopTriggered) return;
  try {
    const captureBytes = directorySizeBytes(CAPTURE_DIR);
    const captureMb = bytesToMiB(captureBytes);
    const budgetPercent = Math.min(100, Math.round((captureBytes / (CAPTURE_BUDGET_MB * MIB)) * 1000) / 10);
    writeState({
      captureBytes,
      captureMb,
      captureBudgetMb: CAPTURE_BUDGET_MB,
      captureWarnMb: CAPTURE_WARN_MB,
      captureStopAtMb: CAPTURE_STOP_AT_MB,
      budgetPercent,
    });

    if (!captureWarned && captureBytes >= CAPTURE_WARN_MB * MIB) {
      captureWarned = true;
      journal('capture-budget-warning', { captureBytes, captureMb, budgetMb: CAPTURE_BUDGET_MB });
      console.warn(`[size] Capture is ${captureMb.toFixed(2)} MiB. Clean-stop target is about ${CAPTURE_STOP_AT_MB} MiB (${CAPTURE_BUDGET_MB} MiB budget).`);
    }

    if (captureBytes >= CAPTURE_STOP_AT_MB * MIB) {
      budgetStopTriggered = true;
      journal('capture-budget-stop', { captureBytes, captureMb, budgetMb: CAPTURE_BUDGET_MB, stopAtMb: CAPTURE_STOP_AT_MB });
      console.warn(`[size] Capture reached ${captureMb.toFixed(2)} MiB; capture budget reached. Starting clean stop and ChatGPT packaging.`);
      void shutdown('capture budget reached', { exitCode: 0 });
    }
  } catch (error) {
    console.warn('[size] Could not measure capture directory:', error.message);
  }
}

function checkStopRequest() {
  if (shuttingDown) return;
  try {
    if (!fs.existsSync(STOP_REQUEST_PATH)) return;
    const requestedAt = fs.readFileSync(STOP_REQUEST_PATH, 'utf8').trim() || null;
    fs.rmSync(STOP_REQUEST_PATH, { force: true });
    journal('gui-stop-request', { requestedAt });
    console.log('[GUI] Clean stop requested. Finalizing capture...');
    void shutdown('GUI stop request', { exitCode: 0 });
  } catch (error) {
    console.warn('[GUI] Could not process stop request:', error.message);
  }
}

async function shutdown(reason, { contextAlreadyClosed = false, exitCode = null } = {}) {
  if (shutdownPromise) return shutdownPromise;

  shuttingDown = true;
  shutdownPromise = (async () => {
    const urgentWindowsConsoleClose = process.platform === 'win32' && reason === 'SIGHUP';
    const guiCleanStop = reason === 'GUI stop request';
    const budgetCleanStop = reason === 'capture budget reached';
    const managedCleanStop = guiCleanStop || budgetCleanStop;
    const queueTimeoutMs = urgentWindowsConsoleClose ? 1000 : (managedCleanStop ? 10000 : 2500);
    const harTimeoutMs = urgentWindowsConsoleClose ? 3500 : (managedCleanStop ? 30000 : 5000);
    const contextTimeoutMs = urgentWindowsConsoleClose ? 2500 : (managedCleanStop ? 15000 : 5000);

    console.log(`\n[shutdown] ${reason}`);
    writeState({ status: 'stopping', stopReason: reason });
    journal('shutdown-start', { reason, contextAlreadyClosed });

    if (stopRequestTimer) {
      clearInterval(stopRequestTimer);
      stopRequestTimer = null;
    }

    if (captureSizeTimer) {
      clearInterval(captureSizeTimer);
      captureSizeTimer = null;
    }

    if (harTimer) {
      clearInterval(harTimer);
      harTimer = null;
    }

    // Finish any in-progress rotation first, but never wait forever during a
    // Windows SIGHUP/console-close shutdown.
    try {
      await withTimeout(harQueue, queueTimeoutMs, 'HAR rotation queue');
    } catch (error) {
      journal('shutdown-warning', { step: 'harQueue', error: error.message });
    }

    if (!contextAlreadyClosed && !contextClosed && context) {
      // Finalize HAR BEFORE closing the context. This ordering is the important
      // difference from the original script.
      try {
        await withTimeout(stopHarSegment(reason), harTimeoutMs, 'HAR finalization');
      } catch (error) {
        journal('shutdown-warning', { step: 'stopHar', error: error.message });
      }

      try {
        await withTimeout(
          context.close({ reason: `capture shutdown: ${reason}` }),
          contextTimeoutMs,
          'context.close',
        );
      } catch (error) {
        journal('shutdown-warning', { step: 'context.close', error: error.message });
      }
    }

    journal('shutdown-complete', { reason });
    closeJournal();
    clearInterval(fsyncTimer);

    let mergedHar = null;
    let mergeError = null;
    const budgetBytes = CAPTURE_BUDGET_MB * MIB;
    const rawCaptureBytes = directorySizeBytes(CAPTURE_DIR);
    if (AUTO_MERGE) {
      const estimatedMergeBytes = trafficHarBytes(CAPTURE_DIR) + (2 * MIB);
      if (rawCaptureBytes + estimatedMergeBytes > budgetBytes) {
        mergeError = `Automatic merged.har skipped to keep this session near the ${CAPTURE_BUDGET_MB} MiB capture budget.`;
        console.warn('[HAR]', mergeError);
      } else {
        try {
          const { mergeHarDirectory } = require('./merge-hars');
          const result = mergeHarDirectory(CAPTURE_DIR, path.join(CAPTURE_DIR, 'merged.har'));
          mergedHar = result.output;
          const afterMergeBytes = directorySizeBytes(CAPTURE_DIR);
          if (afterMergeBytes > budgetBytes) {
            try { fs.rmSync(mergedHar, { force: true }); } catch {}
            mergedHar = null;
            mergeError = `merged.har was removed because it pushed the session past the ${CAPTURE_BUDGET_MB} MiB capture budget.`;
            console.warn('[HAR]', mergeError);
          } else {
            console.log(`[HAR] merged ${result.segments} segment(s) -> ${mergedHar}`);
          }
        } catch (error) {
          mergeError = error.message;
          console.warn('[HAR] automatic merge skipped/failed:', error.message);
        }
      }
    }

    let uploadPackageDir = null;
    let uploadParts = [];
    let packageError = null;
    if (AUTO_PACKAGE_CHATGPT) {
      writeState({ status: 'packaging', captureBytes: directorySizeBytes(CAPTURE_DIR) });
      try {
        const { packageCapture } = require('./package-for-chatgpt');
        const packaged = packageCapture(CAPTURE_DIR, { partMb: CHATGPT_ZIP_PART_MB });
        uploadPackageDir = packaged.outputDir;
        uploadParts = packaged.archives.map(item => ({ name: item.name, bytes: item.bytes, path: item.path }));
        console.log(`[upload] created ${uploadParts.length} ChatGPT ZIP part(s) -> ${uploadPackageDir}`);
      } catch (error) {
        packageError = error.message;
        console.warn('[upload] automatic ChatGPT packaging failed:', error.message);
      }
    }

    const finalCaptureBytes = directorySizeBytes(CAPTURE_DIR);
    writeState({
      status: 'stopped',
      endedAt: new Date().toISOString(),
      stopReason: reason,
      mergedHar,
      mergeError,
      uploadPackageDir,
      uploadParts,
      packageError,
      captureBytes: finalCaptureBytes,
      captureMb: bytesToMiB(finalCaptureBytes),
      captureBudgetMb: CAPTURE_BUDGET_MB,
      exitCode: exitCode === null ? 0 : exitCode,
      currentHar: null,
    });
    releaseLock();

    if (exitCode !== null) process.exitCode = exitCode;
    resolveDone();
  })();

  return shutdownPromise;
}

function installProcessHandlers() {
  const signalHandlers = [
    ['SIGINT', 130],
    ['SIGTERM', 143],
    ['SIGHUP', 129],
  ];

  // SIGBREAK exists on Windows. Registering it is harmless where supported.
  if (process.platform === 'win32') signalHandlers.push(['SIGBREAK', 131]);

  for (const [signal, code] of signalHandlers) {
    process.once(signal, () => {
      void shutdown(signal, { exitCode: code });
    });
  }

  process.once('uncaughtException', error => {
    journal('uncaught-exception', {
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
    console.error(error);
    void shutdown('uncaughtException', { exitCode: 1 });
  });

  process.once('unhandledRejection', reason => {
    journal('unhandled-rejection', {
      reason: reason instanceof Error ? reason.stack || reason.message : String(reason),
    });
    console.error('[unhandledRejection]', reason);
    void shutdown('unhandledRejection', { exitCode: 1 });
  });

  // beforeExit is NOT a substitute for signal handling. It is only a last
  // chance for a normal empty-event-loop exit.
  process.on('beforeExit', () => {
    fsyncJournal(true);
    if (!shuttingDown) void shutdown('beforeExit');
  });

  // The exit event cannot run async work, so only do synchronous disk flush.
  process.on('exit', () => {
    closeJournal();
    releaseLock();
  });
}

async function main() {
  installProcessHandlers();
  try { fs.rmSync(STOP_REQUEST_PATH, { force: true }); } catch {}

  writeState({ status: 'starting', pid: process.pid, captureDir: CAPTURE_DIR });
  console.log('Capture directory:', CAPTURE_DIR);
  console.log('Node:', process.version);
  console.log('Playwright:', playwrightVersion);
  console.log(`Capture budget: ${CAPTURE_BUDGET_MB} MiB (warning ${CAPTURE_WARN_MB} MiB; clean-stop target ~${CAPTURE_STOP_AT_MB} MiB)`);
  console.log(`ChatGPT ZIP parts: <= ${CHATGPT_ZIP_PART_MB} MiB`);
  if(BRAVE_CDP_PORT)console.warn(`[browser-mcp] localhost: ${BRAVE_CDP_PORT}; trusted local programs can inspect/control this dedicated Brave profile while capture is active.`);

  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    executablePath: BRAVE_EXE,
    // Playwright normally injects --disable-extensions. Remove only that default
    // so the dedicated unpacked Idle Hacking extension can load in Brave.
    ignoreDefaultArgs: ['--disable-extensions'],

    // Let OUR handlers perform ordered HAR -> context shutdown instead of
    // Playwright racing us to close the browser first.
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,

    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
      // Opt-in localhost debugger for Playwright MCP; never expose it on the LAN.
      ...(BRAVE_CDP_PORT ? ['--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${BRAVE_CDP_PORT}`] : []),
      `--log-net-log=${NETLOG_PATH}`,
      ...(NETLOG_MODE && NETLOG_MODE !== 'Default'
        ? [`--net-log-capture-mode=${NETLOG_MODE}`]
        : []),
      `--net-log-max-size-mb=${NETLOG_MAX_MB}`,
    ],
  });

  attachContextNetworkLogging(context);

  // IdleHacking extension target check. This is intentionally diagnostic only:
  // a sleeping MV3 service worker may not always be visible immediately, so a
  // missing target is logged instead of aborting the capture.
  try {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const probePage = context.pages()[0] || await context.newPage();
    const cdp = await context.newCDPSession(probePage);
    const targetResult = await cdp.send('Target.getTargets');
    const extensionTargets = (targetResult.targetInfos || []).filter(info =>
      typeof info.url === 'string' && info.url.startsWith('chrome-extension://')
    );
    await cdp.detach();
    if (extensionTargets.length) {
      const ids = [...new Set(extensionTargets.map(info => info.url.split('/')[2]).filter(Boolean))];
      console.log(`[extension] Brave reports ${extensionTargets.length} extension target(s): ${ids.join(', ') || 'loaded'}`);
      journal('extension-target-check', { loaded: true, targetCount: extensionTargets.length, extensionIds: ids });
    } else {
      console.warn('[extension] No chrome-extension target was visible yet. Check brave://extensions if the Suite UI is absent.');
      journal('extension-target-check', { loaded: false, targetCount: 0 });
    }
  } catch (error) {
    console.warn(`[extension] Target verification was unavailable: ${error.message}`);
    journal('extension-target-check-error', { message: error.message });
  }

  context.once('close', () => {
    contextClosed = true;
    journal('context-close', {});
    // If the user clicked Brave's X, Playwright can no longer finalize the
    // currently-active HAR. Previous rotated HARs + NDJSON + NetLog survive.
    void shutdown('browser/context closed', { contextAlreadyClosed: true });
  });

  const browser = context.browser();
  if (browser) {
    browser.once('disconnected', () => {
      journal('browser-disconnected', {});
      if (!shuttingDown) {
        void shutdown('browser disconnected', { contextAlreadyClosed: true });
      }
    });
  }

  stopRequestTimer = setInterval(checkStopRequest, 500);
  captureSizeTimer = setInterval(checkCaptureSize, CAPTURE_SIZE_CHECK_MS);
  captureSizeTimer.unref();
  checkCaptureSize();

  if (typeof context.tracing?.startHar === 'function') {
    await startHarSegment();
    harTimer = setInterval(() => {
      void queueHarRotation('timer');
    }, HAR_SEGMENT_MS);
    harTimer.unref();
  } else {
    console.warn(
      '[HAR] context.tracing.startHar() is unavailable. Upgrade Playwright to >= 1.60. ' +
        'The NDJSON journal and Chromium NetLog are still recording.',
    );
    journal('har-unavailable', { playwrightVersion });
  }

  let page = context.pages()[0];
  if (!page) page = await context.newPage();

  if (!page.url() || page.url() === 'about:blank') {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  } else if (!page.url().startsWith(TARGET_URL)) {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }

  console.log('\nCapture is active.');
  console.log("Preferred stop method: use the GUI's Stop Capture Cleanly button (or Ctrl+C).");
  console.log('Closing Brave is recoverable, but the current HAR segment may be lost.');
  console.log('Hard-killing Node/terminal cannot run cleanup; use network.ndjson for recovery.\n');

  await done;
  await shutdownPromise;
}

main().catch(error => {
  journal('main-error', { message: error.message, stack: error.stack || null });
  console.error(error);
  writeState({ status: 'error', error: error.message, endedAt: new Date().toISOString() });
  if (shutdownPromise) return;
  void shutdown('main error', { exitCode: 1 });
});
