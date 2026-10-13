#!/usr/bin/env node
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const a = fs.readFileSync(path.join(__dirname, 'stickman-studio.gz.b64.a'), 'utf8').trim();
const b = fs.readFileSync(path.join(__dirname, 'stickman-studio.gz.b64.b'), 'utf8').trim();
const gz = Buffer.from(a + b, 'base64');
const out = zlib.gunzipSync(gz);
const target = path.join(__dirname, '..', 'src', 'components', 'StickmanStudio.astro');
fs.writeFileSync(target, out);
console.log('Restored', target, out.length, 'bytes');
