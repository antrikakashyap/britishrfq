// Checks that every relative link and image in the Markdown files points at a real file.
//   node scripts/check-links.mjs        (or: npm run docs:links)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const skip = new Set(['node_modules', '.git', 'dist', 'data']);
const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    if (skip.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.md')) files.push(p);
  }
})(root);

let bad = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, '');
  const refs = [...text.matchAll(/\]\(([^)\s]+)\)/g), ...text.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  for (const r of refs) {
    if (/^(https?:|mailto:|#)/.test(r)) continue;
    const target = resolve(dirname(f), r.split('#')[0]);
    if (!existsSync(target)) {
      bad++;
      console.log(`MISSING  ${f.slice(root.length + 1)}  ->  ${r}`);
    }
  }
}
console.log(bad ? `${bad} broken link(s)` : `All local links are fine (${files.length} Markdown files checked).`);
process.exit(bad ? 1 : 0);
