'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MIB = 1024 * 1024;
const DEFAULT_PART_MB = 430;
const EXCLUDED_NAMES = new Set([
  'merged.har',
  'recovered.har',
  'CHATGPT-UPLOAD-MANIFEST.json',
  'CHATGPT-UPLOAD-README.txt',
]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Buffer(buffer, crc = 0) {
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function crc32FileRange(filePath, offset, length) {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let position = offset;
  let remaining = length;
  let crc = 0;
  try {
    while (remaining > 0) {
      const want = Math.min(buffer.length, remaining);
      const got = fs.readSync(fd, buffer, 0, want, position);
      if (got <= 0) throw new Error(`Unexpected EOF while checksumming ${filePath}`);
      crc = crc32Buffer(buffer.subarray(0, got), crc);
      position += got;
      remaining -= got;
    }
  } finally {
    fs.closeSync(fd);
  }
  return crc >>> 0;
}

function dosDateTime(date = new Date()) {
  let year = Math.max(1980, date.getFullYear());
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day = ((year - 1980) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, date: day };
}

function makeLocalHeader(nameBytes, crc, size, stamp) {
  const b = Buffer.alloc(30);
  b.writeUInt32LE(0x04034b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(0x0800, 6); // UTF-8 names
  b.writeUInt16LE(0, 8); // STORE - deliberately no compression for predictable part size
  b.writeUInt16LE(stamp.time, 10);
  b.writeUInt16LE(stamp.date, 12);
  b.writeUInt32LE(crc >>> 0, 14);
  b.writeUInt32LE(size >>> 0, 18);
  b.writeUInt32LE(size >>> 0, 22);
  b.writeUInt16LE(nameBytes.length, 26);
  b.writeUInt16LE(0, 28);
  return b;
}

function makeCentralHeader(nameBytes, crc, size, stamp, localOffset) {
  const b = Buffer.alloc(46);
  b.writeUInt32LE(0x02014b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(20, 6);
  b.writeUInt16LE(0x0800, 8);
  b.writeUInt16LE(0, 10);
  b.writeUInt16LE(stamp.time, 12);
  b.writeUInt16LE(stamp.date, 14);
  b.writeUInt32LE(crc >>> 0, 16);
  b.writeUInt32LE(size >>> 0, 20);
  b.writeUInt32LE(size >>> 0, 24);
  b.writeUInt16LE(nameBytes.length, 28);
  b.writeUInt16LE(0, 30);
  b.writeUInt16LE(0, 32);
  b.writeUInt16LE(0, 34);
  b.writeUInt16LE(0, 36);
  b.writeUInt32LE(0, 38);
  b.writeUInt32LE(localOffset >>> 0, 42);
  return b;
}

function makeEndRecord(entryCount, centralSize, centralOffset) {
  if (entryCount > 0xffff) throw new Error('Too many ZIP entries for non-Zip64 archive.');
  const b = Buffer.alloc(22);
  b.writeUInt32LE(0x06054b50, 0);
  b.writeUInt16LE(0, 4);
  b.writeUInt16LE(0, 6);
  b.writeUInt16LE(entryCount, 8);
  b.writeUInt16LE(entryCount, 10);
  b.writeUInt32LE(centralSize >>> 0, 12);
  b.writeUInt32LE(centralOffset >>> 0, 16);
  b.writeUInt16LE(0, 20);
  return b;
}

function writeAll(fd, buffer) {
  let offset = 0;
  while (offset < buffer.length) offset += fs.writeSync(fd, buffer, offset, buffer.length - offset);
}

function writeFileRange(fdOut, filePath, offset, length) {
  const fdIn = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  let position = offset;
  let remaining = length;
  try {
    while (remaining > 0) {
      const want = Math.min(buffer.length, remaining);
      const got = fs.readSync(fdIn, buffer, 0, want, position);
      if (got <= 0) throw new Error(`Unexpected EOF while packaging ${filePath}`);
      writeAll(fdOut, buffer.subarray(0, got));
      position += got;
      remaining -= got;
    }
  } finally {
    fs.closeSync(fdIn);
  }
}

function writeStoredZip(outputPath, entries) {
  const fd = fs.openSync(outputPath, 'w');
  const central = [];
  let cursor = 0;
  try {
    for (const entry of entries) {
      const nameBytes = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
      if (nameBytes.length > 0xffff) throw new Error(`ZIP entry name too long: ${entry.name}`);
      const stamp = dosDateTime(entry.mtime || new Date());
      const size = entry.buffer ? entry.buffer.length : entry.length;
      if (size > 0xffffffff) throw new Error(`ZIP entry too large for non-Zip64 archive: ${entry.name}`);
      const crc = entry.buffer
        ? crc32Buffer(entry.buffer)
        : crc32FileRange(entry.filePath, entry.offset || 0, entry.length);
      const localOffset = cursor;
      const local = makeLocalHeader(nameBytes, crc, size, stamp);
      writeAll(fd, local);
      writeAll(fd, nameBytes);
      cursor += local.length + nameBytes.length;
      if (entry.buffer) writeAll(fd, entry.buffer);
      else writeFileRange(fd, entry.filePath, entry.offset || 0, entry.length);
      cursor += size;
      central.push({ nameBytes, crc, size, stamp, localOffset });
    }

    const centralOffset = cursor;
    for (const entry of central) {
      const header = makeCentralHeader(entry.nameBytes, entry.crc, entry.size, entry.stamp, entry.localOffset);
      writeAll(fd, header);
      writeAll(fd, entry.nameBytes);
      cursor += header.length + entry.nameBytes.length;
    }
    const centralSize = cursor - centralOffset;
    const end = makeEndRecord(central.length, centralSize, centralOffset);
    writeAll(fd, end);
    cursor += end.length;
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return cursor;
}

function sanitizeSessionName(name) {
  return name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'capture';
}

function listSourceFiles(captureDir) {
  return fs.readdirSync(captureDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const filePath = path.join(captureDir, entry.name);
      const stat = fs.statSync(filePath);
      return { name: entry.name, filePath, size: stat.size, mtime: stat.mtime };
    })
    .filter(file => !EXCLUDED_NAMES.has(file.name) && !/\.zip$/i.test(file.name))
    .sort((a, b) => {
      const aHar = /^traffic-\d+\.har$/i.test(a.name);
      const bHar = /^traffic-\d+\.har$/i.test(b.name);
      if (aHar !== bHar) return aHar ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
}

function planChunks(files, payloadCap) {
  const result = [];
  for (const file of files) {
    const count = Math.max(1, Math.ceil(file.size / payloadCap));
    let offset = 0;
    const chunks = [];
    for (let index = 0; index < count; index += 1) {
      const length = Math.min(payloadCap, file.size - offset);
      const split = count > 1;
      const entryName = split
        ? `${file.name}.chunk${String(index + 1).padStart(3, '0')}-of-${String(count).padStart(3, '0')}`
        : file.name;
      const chunk = {
        sourceName: file.name,
        sourcePath: file.filePath,
        sourceSize: file.size,
        entryName,
        chunkIndex: index + 1,
        chunkCount: count,
        offset,
        length,
        mtime: file.mtime,
      };
      chunks.push(chunk);
      result.push(chunk);
      offset += length;
    }
    file.chunks = chunks;
  }
  return result;
}

function groupChunks(chunks, payloadCap) {
  const groups = [];
  let current = [];
  let used = 0;
  for (const chunk of chunks) {
    if (current.length && used + chunk.length > payloadCap) {
      groups.push(current);
      current = [];
      used = 0;
    }
    current.push(chunk);
    used += chunk.length;
  }
  if (current.length) groups.push(current);
  return groups;
}

function buildReadme(manifest) {
  const splitFiles = manifest.files.filter(file => file.chunks.length > 1).map(file => file.sourceName);
  return Buffer.from([
    'IDLE HACKING - CHATGPT UPLOAD PACKAGE',
    '=======================================',
    '',
    `Session: ${manifest.sourceSession}`,
    `ZIP parts: ${manifest.archives.length}`,
    '',
    'Upload every numbered ZIP part to the same ChatGPT conversation.',
    'Each ZIP is independent and can be opened by itself.',
    '',
    'The raw capture intentionally excludes merged.har and recovered.har because',
    'they duplicate data already present in the segmented HAR/journal files.',
    '',
    splitFiles.length
      ? `Large files were split into chunks: ${splitFiles.join(', ')}. The JSON manifest contains offsets and ordering so they can be reassembled exactly.`
      : 'No source file required chunk splitting.',
    '',
    'WARNING: captures may contain cookies, authentication/session tokens, request',
    'headers, and other sensitive data.',
    '',
  ].join('\r\n'), 'utf8');
}

function packageCapture(captureDir, options = {}) {
  captureDir = path.resolve(captureDir);
  if (!fs.existsSync(captureDir) || !fs.statSync(captureDir).isDirectory()) {
    throw new Error(`Capture directory not found: ${captureDir}`);
  }

  const partMb = Math.max(1, Number(options.partMb || DEFAULT_PART_MB));
  const partSizeBytes = Math.floor(partMb * MIB);
  const manifestReserve = Math.min(256 * 1024, Math.max(32 * 1024, Math.floor(partSizeBytes * 0.10)));
  const headerReserve = Math.min(64 * 1024, Math.max(16 * 1024, Math.floor(partSizeBytes * 0.03)));
  const payloadCap = partSizeBytes - manifestReserve - headerReserve;
  if (payloadCap < 64 * 1024) throw new Error(`ZIP part size ${partMb} MiB is too small.`);

  const sessionName = sanitizeSessionName(path.basename(captureDir));
  const root = path.dirname(path.dirname(captureDir));
  const outputDir = path.resolve(options.outputDir || path.join(root, 'ChatGPT Uploads', sessionName));
  fs.mkdirSync(outputDir, { recursive: true });

  for (const entry of fs.readdirSync(outputDir, { withFileTypes: true })) {
    if (entry.isFile() && (/\.zip$/i.test(entry.name) || /^CHATGPT-UPLOAD-/i.test(entry.name))) {
      fs.rmSync(path.join(outputDir, entry.name), { force: true });
    }
  }

  const files = listSourceFiles(captureDir);
  if (!files.length) throw new Error(`No capture files found in ${captureDir}`);
  const chunks = planChunks(files, payloadCap);
  const groups = groupChunks(chunks, payloadCap);
  const totalParts = groups.length;
  const pad = Math.max(2, String(totalParts).length);
  const archives = groups.map((group, index) => ({
    part: index + 1,
    name: `IdleHacking-Capture-${sessionName}-part${String(index + 1).padStart(pad, '0')}-of-${String(totalParts).padStart(pad, '0')}.zip`,
    chunks: group,
  }));
  for (const archive of archives) {
    for (const chunk of archive.chunks) chunk.archive = archive.name;
  }

  const manifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    sourceSession: path.basename(captureDir),
    sourceCaptureDir: captureDir,
    partSizeBytes,
    partSizeMiB: partMb,
    storageMethod: 'ZIP STORE (no compression; predictable maximum part size)',
    excludedDerivedFiles: ['merged.har', 'recovered.har'],
    uploadInstructions: 'Upload every numbered ZIP part to the same ChatGPT conversation. If a file has multiple chunks, reassemble chunks in chunkIndex order before parsing it.',
    files: files.map(file => ({
      sourceName: file.name,
      size: file.size,
      chunks: file.chunks.map(chunk => ({
        archive: chunk.archive,
        entryName: chunk.entryName,
        chunkIndex: chunk.chunkIndex,
        chunkCount: chunk.chunkCount,
        offset: chunk.offset,
        length: chunk.length,
      })),
    })),
    archives: archives.map(archive => ({
      part: archive.part,
      name: archive.name,
      payloadBytes: archive.chunks.reduce((sum, chunk) => sum + chunk.length, 0),
      entries: archive.chunks.map(chunk => chunk.entryName),
    })),
  };

  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  if (manifestBuffer.length > manifestReserve) {
    throw new Error(`Upload manifest grew beyond reserved size (${manifestBuffer.length} > ${manifestReserve}).`);
  }
  const readmeBuffer = buildReadme(manifest);

  const written = [];
  for (const archive of archives) {
    const outputPath = path.join(outputDir, archive.name);
    const zipEntries = [
      { name: 'CHATGPT-UPLOAD-MANIFEST.json', buffer: manifestBuffer, mtime: new Date() },
      { name: 'CHATGPT-UPLOAD-README.txt', buffer: readmeBuffer, mtime: new Date() },
      ...archive.chunks.map(chunk => ({
        name: chunk.entryName,
        filePath: chunk.sourcePath,
        offset: chunk.offset,
        length: chunk.length,
        mtime: chunk.mtime,
      })),
    ];
    const bytes = writeStoredZip(outputPath, zipEntries);
    if (bytes > partSizeBytes) {
      fs.rmSync(outputPath, { force: true });
      throw new Error(`Generated ZIP exceeded configured maximum: ${archive.name} (${bytes} > ${partSizeBytes})`);
    }
    written.push({ path: outputPath, name: archive.name, bytes });
  }

  const manifestPath = path.join(outputDir, 'CHATGPT-UPLOAD-MANIFEST.json');
  const readmePath = path.join(outputDir, 'CHATGPT-UPLOAD-README.txt');
  fs.writeFileSync(manifestPath, manifestBuffer);
  fs.writeFileSync(readmePath, readmeBuffer);

  return {
    outputDir,
    partMb,
    partSizeBytes,
    archives: written,
    manifestPath,
    sourceBytes: files.reduce((sum, file) => sum + file.size, 0),
  };
}

function parseCli(argv) {
  if (!argv.length) throw new Error('Usage: node package-for-chatgpt.js <capture-directory> [--part-mb 430] [--output <directory>]');
  const captureDir = argv[0];
  const options = {};
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === '--part-mb') options.partMb = Number(argv[++i]);
    else if (argv[i] === '--output') options.outputDir = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return { captureDir, options };
}

if (require.main === module) {
  try {
    const { captureDir, options } = parseCli(process.argv.slice(2));
    const result = packageCapture(captureDir, options);
    console.log(`Created ${result.archives.length} ChatGPT upload ZIP part(s) in:`);
    console.log(result.outputDir);
    for (const archive of result.archives) {
      console.log(`  ${archive.name}  ${(archive.bytes / MIB).toFixed(2)} MiB`);
    }
  } catch (error) {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = { packageCapture };
