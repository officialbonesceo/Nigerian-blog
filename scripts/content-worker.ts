/**
 * content-worker entry: decode base64 parts and run fixed UTC-quota worker
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const dir = dirname(fileURLToPath(import.meta.url));
const b64 = [0,1,2,3,4,5].map(i => {
  try { return readFileSync(join(dir, `cw-b64-${i}.txt`), 'utf8').trim(); } catch { return ''; }
}).join('');
if (!b64 || b64.length < 1000) {
  console.error('Missing cw-b64 parts');
  process.exit(1);
}
const src = Buffer.from(b64, 'base64').toString('utf8');
if (!src.includes('dayStartIso') || !src.includes('DAILY_QUOTA_PER_CATEGORY')) {
  console.error('Decoded worker missing UTC quota fix');
  process.exit(1);
}
const out = join(tmpdir(), `9jabeacon-cw-${process.pid}.ts`);
writeFileSync(out, src);
const r = spawnSync('npx', ['tsx', out], { stdio: 'inherit', env: process.env });
try { unlinkSync(out); } catch {}
process.exit(r.status ?? 1);
