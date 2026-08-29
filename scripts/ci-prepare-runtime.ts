import fs from 'node:fs';
import path from 'node:path';

/**
 * CI-only guard: production ingestion must use D1 as the source of truth.
 *
 * db.ts historically seeded local categories/sources/articles whenever a new
 * SQLite process opened the database. That is useful for local mockups but it
 * is wrong in CI because every new Node process would re-add the old mock data
 * after the D1 snapshot had already been loaded.
 *
 * GitHub-hosted runners are ephemeral, so this patch changes only the checked
 * out workspace for the current run. The repository source remains untouched.
 */
const filePath = path.resolve(process.cwd(), 'src/lib/db.ts');
const source = fs.readFileSync(filePath, 'utf8');

const startMarker = '  // Seed/Upsert Categories';
const endMarker = '  // Seed default automation settings';
const alreadyPatched = 'if (process.env.ALLOW_SEED_DATA === \'true\') {';

if (source.includes(alreadyPatched)) {
  console.log('✅ CI runtime seed guard already present.');
  process.exit(0);
}

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);

if (start < 0 || end < 0 || end <= start) {
  throw new Error('Could not locate the local seed block in src/lib/db.ts. Refusing to patch an unknown file layout.');
}

const seedBlock = source.slice(start, end).replace(/\s+$/, '');
const guardedBlock = [
  "  if (process.env.ALLOW_SEED_DATA === 'true') {",
  seedBlock,
  '  }',
  '',
].join('\n');

const patched = source.slice(0, start) + guardedBlock + source.slice(end);
fs.writeFileSync(filePath, patched, 'utf8');

console.log('✅ CI runtime guard installed: local seed categories/sources/articles are disabled.');
console.log('   D1 remains the only production data source for this workflow.');
