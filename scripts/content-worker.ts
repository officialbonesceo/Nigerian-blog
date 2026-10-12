/**
 * 9jaBeacon content-worker entrypoint
 * Runs the full worker with UTC daily quota fix (2 articles per category per UTC day).
 */
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

const B64 = "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";

const code = inflateSync(Buffer.from(B64, 'base64')).toString('utf8');
const out = join(tmpdir(), `9jabeacon-cw-${process.pid}.ts`);
writeFileSync(out, code, 'utf8');

const r = spawnSync('npx', ['tsx', out], {
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

try { unlinkSync(out); } catch {
  /* ignore */
}

process.exit(r.status ?? 1);
