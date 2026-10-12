/**
 * 9jaBeacon content-worker — reassembles full worker with UTC daily quota fix.
 * Quota: 2 articles per category per UTC calendar day (published_at range).
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const parts = [0, 1, 2, 3, 4, 5]
  .map((i) => {
    try {
      return readFileSync(join(__dirname, `cw-part-${i}.txt`), 'utf8');
    } catch {
      return '';
    }
  })
  .join('');

if (!parts.includes('DAILY_QUOTA_PER_CATEGORY')) {
  console.error('content-worker parts missing or incomplete');
  process.exit(1);
}

const out = join(tmpdir(), `9jabeacon-cw-${process.pid}.ts`);
writeFileSync(out, parts, 'utf8');
const r = spawnSync('npx', ['tsx', out], { stdio: 'inherit', env: process.env });
try { unlinkSync(out); } catch { /* ignore */ }
process.exit(r.status ?? 1);
