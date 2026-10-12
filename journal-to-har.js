'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const inputArg = process.argv[2];
if (!inputArg) {
  console.error('Usage: node journal-to-har.js <network.ndjson | capture-directory> [output.har]');
  process.exit(2);
}

const inputPath = fs.statSync(inputArg).isDirectory()
  ? path.join(inputArg, 'network.ndjson')
  : inputArg;
const outputPath = process.argv[3] || path.join(path.dirname(inputPath), 'recovered.har');

function headersToHar(headers = {}) {
  return Object.entries(headers).map(([name, value]) => ({ name, value: String(value) }));
}

function queryToHar(url) {
  try {
    return [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

function byteLength(value) {
  return value == null ? 0 : Buffer.byteLength(String(value));
}

function msBetween(a, b) {
  const start = Date.parse(a || '');
  const end = Date.parse(b || '');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, end - start);
}

async function main() {
  const requests = new Map();
  let badLines = 0;
  let websocketEvents = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      badLines += 1;
      continue;
    }

    if (event.type.startsWith('websocket-')) {
      websocketEvents += 1;
      continue;
    }

    if (!event.requestId) continue;

    let item = requests.get(event.requestId);
    if (!item) {
      item = { requestId: event.requestId };
      requests.set(event.requestId, item);
    }

    switch (event.type) {
      case 'request':
        item.request = event;
        break;
      case 'response':
        item.response = event;
        break;
      case 'request-finished':
        item.finished = event;
        break;
      case 'request-failed':
        item.failed = event;
        break;
      case 'response-body':
        item.body = event;
        break;
      case 'response-body-skipped':
        item.bodySkipped = event;
        break;
      case 'response-body-error':
        item.bodyError = event;
        break;
      default:
        break;
    }
  }

  const entries = [];

  for (const item of requests.values()) {
    const req = item.request;
    if (!req) continue;

    const res = item.response;
    const terminal = item.finished || item.failed || res || req;
    const elapsed = msBetween(req.ts, terminal.ts);
    const postData = req.postData;
    const requestHeaders = req.headers || {};
    const responseHeaders = res?.headers || {};
    const contentType =
      item.body?.contentType ||
      responseHeaders['content-type'] ||
      responseHeaders['Content-Type'] ||
      'application/octet-stream';

    const content = {
      size: item.body?.bytes ?? item.bodySkipped?.bytes ?? 0,
      mimeType: contentType,
    };

    if (item.body?.data != null) {
      content.text = item.body.data;
      content.encoding = item.body.encoding || 'base64';
    }

    const entry = {
      startedDateTime: req.ts,
      time: elapsed,
      request: {
        method: req.method || 'GET',
        url: req.url || '',
        httpVersion: '',
        cookies: [],
        headers: headersToHar(requestHeaders),
        queryString: queryToHar(req.url || ''),
        headersSize: -1,
        bodySize: byteLength(postData),
      },
      response: {
        status: res?.status ?? 0,
        statusText: res?.statusText || '',
        httpVersion: '',
        cookies: [],
        headers: headersToHar(responseHeaders),
        content,
        redirectURL: responseHeaders.location || responseHeaders.Location || '',
        headersSize: -1,
        bodySize: item.body?.bytes ?? item.bodySkipped?.bytes ?? -1,
      },
      cache: {},
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        send: 0,
        wait: elapsed,
        receive: 0,
        ssl: -1,
      },
      _requestId: item.requestId,
      _resourceType: req.resourceType || null,
      _frameUrl: req.frameUrl || null,
      _serviceWorkerUrl: req.serviceWorkerUrl || null,
      _fromServiceWorker: res?.fromServiceWorker || false,
    };

    if (postData != null) {
      entry.request.postData = {
        mimeType: requestHeaders['content-type'] || requestHeaders['Content-Type'] || '',
        text: postData,
      };
    }

    if (item.failed?.failure) entry._failure = item.failed.failure;
    if (item.bodyError?.error) entry._bodyError = item.bodyError.error;

    entries.push(entry);
  }

  entries.sort((a, b) => Date.parse(a.startedDateTime) - Date.parse(b.startedDateTime));

  const har = {
    log: {
      version: '1.2',
      creator: {
        name: 'IdleHacking crash-recovery converter',
        version: '1.0',
      },
      entries,
      _recoveredFrom: inputPath,
      _badNdjsonLines: badLines,
      _webSocketEventsRemainInNdjson: websocketEvents,
    },
  };

  const tempPath = `${outputPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(har, null, 2));
  fs.renameSync(tempPath, outputPath);

  console.log(`Recovered ${entries.length} HTTP entries -> ${outputPath}`);
  if (badLines) console.log(`Skipped ${badLines} malformed/truncated NDJSON line(s).`);
  if (websocketEvents) {
    console.log(`${websocketEvents} WebSocket journal event(s) remain in network.ndjson (HAR 1.2 has no standard frame model).`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
