const fs = require('node:fs');
const path = require('node:path');

const ROOTS = ['app', 'src'];
const EXTENSIONS = new Set(['.tsx']);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function readOpeningTag(source, start) {
  let i = start + '<Pressable'.length;
  let brace = 0;
  let quote = null;

  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === quote && source[i - 1] !== '\\') quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '{') {
      brace += 1;
    } else if (ch === '}') {
      brace = Math.max(0, brace - 1);
    } else if (ch === '>' && brace === 0) {
      return { tag: source.slice(start, i + 1), end: i + 1 };
    }
    i += 1;
  }

  return { tag: source.slice(start), end: source.length };
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

const problems = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const source = fs.readFileSync(file, 'utf8');
    let index = 0;
    while (true) {
      const start = source.indexOf('<Pressable', index);
      if (start === -1) break;
      const { tag, end } = readOpeningTag(source, start);
      const hasAction = /\bonPress\s*=/.test(tag);
      const hasDisabled = /\bdisabled\b/.test(tag);
      if (!hasAction && !hasDisabled) {
        problems.push({
          file,
          line: lineNumber(source, start),
          message: 'Pressable must have onPress or disabled.',
          tag: tag.replace(/\s+/g, ' ').slice(0, 180),
        });
      }
      index = end;
    }
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`${problem.file}:${problem.line} ${problem.message}`);
    console.error(`  ${problem.tag}`);
  }
  process.exit(1);
}

console.log('Interaction audit passed.');
