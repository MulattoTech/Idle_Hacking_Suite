'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Merges HAR segments without retaining the entire multi-hour merged capture in
// memory. Only one 60-second segment is parsed at a time; entries are streamed
// into the destination HAR as they are transformed.
function mergeHarDirectory(dir, output = path.join(dir, 'merged.har')) {
  const files = fs
    .readdirSync(dir)
    .filter(name => /^traffic-\d+\.har$/i.test(name))
    .sort();

  if (!files.length) throw new Error(`No traffic-*.har files found in ${dir}`);

  const temp = `${output}.tmp`;
  const fd = fs.openSync(temp, 'w');
  const pages = [];
  const segments = [];
  const skippedFiles = [];
  let entryCount = 0;
  let firstEntry = true;

  const write = text => fs.writeSync(fd, text, null, 'utf8');

  try {
    write('{"log":{"version":"1.2","creator":{"name":"IdleHacking HAR segment merger","version":"2.1"},"entries":[');

    for (const file of files) {
      const fullPath = path.join(dir, file);
      let har;
      try {
        har = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      } catch (error) {
        skippedFiles.push({ file, error: error.message });
        continue;
      }

      if (!har?.log?.entries || !Array.isArray(har.log.entries)) {
        skippedFiles.push({ file, error: 'missing log.entries' });
        continue;
      }

      const pageMap = new Map();
      for (const page of har.log.pages || []) {
        const oldId = page.id || `page-${pages.length + 1}`;
        const newId = `${file}:${oldId}`;
        pageMap.set(oldId, newId);
        pages.push({ ...page, id: newId });
      }

      let segmentEntries = 0;
      for (const entry of har.log.entries) {
        const copy = { ...entry, _sourceSegment: file };
        if (copy.pageref && pageMap.has(copy.pageref)) copy.pageref = pageMap.get(copy.pageref);
        if (!firstEntry) write(',');
        write(JSON.stringify(copy));
        firstEntry = false;
        entryCount += 1;
        segmentEntries += 1;
      }
      segments.push({ file, entries: segmentEntries });
    }

    if (!entryCount) throw new Error('No valid HAR entries were found.');

    write('],"pages":');
    write(JSON.stringify(pages));
    write(',"_segments":');
    write(JSON.stringify(segments));
    write(',"_skippedSegments":');
    write(JSON.stringify(skippedFiles));
    write('}}');
    fs.fsyncSync(fd);
  } catch (error) {
    try { fs.closeSync(fd); } catch {}
    try { fs.rmSync(temp, { force: true }); } catch {}
    throw error;
  }

  fs.closeSync(fd);
  fs.renameSync(temp, output);

  return {
    output,
    segments: segments.length,
    entries: entryCount,
    skipped: skippedFiles.length,
    skippedFiles,
  };
}

if (require.main === module) {
  const dir = process.argv[2] || process.cwd();
  const output = process.argv[3] || path.join(dir, 'merged.har');
  try {
    const result = mergeHarDirectory(dir, output);
    console.log(`Merged ${result.segments} valid segment(s), ${result.entries} entries -> ${result.output}`);
    if (result.skipped) console.log(`Skipped ${result.skipped} invalid/incomplete segment(s).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { mergeHarDirectory };
