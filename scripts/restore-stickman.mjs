#!/usr/bin/env node
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
const d=path.dirname(fileURLToPath(import.meta.url));
let b64='';
for (let i=0;i<7;i++) b64+=fs.readFileSync(path.join(d,`stickman-p${i}.txt`),'utf8').trim();
const out=zlib.gunzipSync(Buffer.from(b64,'base64'));
fs.writeFileSync(path.join(d,'..','src','components','StickmanStudio.astro'), out);
console.log('OK', out.length);
