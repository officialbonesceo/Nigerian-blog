/**
 * 9jaBeacon Desk Brief MP4 — minimal reliable renderer
 * Isolated workflow only. Does not touch site, D1, or content-delivery.
 *
 * Approach that works on GHA ffmpeg:
 * - One stickman pose (no timed enable chain)
 * - Inline -filter_complex (no filter_complex_script)
 * - Simple drawbox/drawtext lower-third + boards
 * - Edge TTS voiceover
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DEFAULT_SCRIPT =
  'Good evening. This is 9jaBeacon. We start with breaking news from the Southeast. Twenty prospective National Youth Service Corps members, abducted in Imo State, have been rescued after a week in captivity. The graduates were seized while travelling in Imo, a state that has seen a rise in kidnapping-for-ransom along major routes. After seven days in the hands of their abductors, all twenty regained their freedom. Here is what we know. Twenty prospective corps members. Seven days in captivity. Abducted in Imo State. Reunited with their families in Ibadan, the Oyo State capital. Security agencies have not released full operational details of the rescue. The case renews urgent questions about the safety of young Nigerians travelling to NYSC orientation camps, especially through high-risk corridors in the Southeast. For now, the families have their children back. The bigger picture remains clear: Nigeria must secure the roads that take our graduates to service. We will continue to follow this story. This is 9jaBeacon. Stay informed. Subscribe for more.';

const DEFAULT_HEADLINE = 'NYSC members rescued after week in captivity';
const DEFAULT_TICKER =
  'NYSC Imo rescue  ·  Families reunited in Ibadan  ·  Southeast travel safety watch  ·  www.9jabeacon.name.ng';

function run(cmd) {
  console.log('> ' + cmd.slice(0, 180) + (cmd.length > 180 ? '...' : ''));
  execSync(cmd, { stdio: 'inherit' });
}

function which(bin) {
  try {
    return execSync('which ' + bin, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function cleanDraw(s, max) {
  return String(s || '')
    .replace(/[:\\'%]/g, ' ')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 90);
}

function truncateHeadline(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 3).trimEnd() + '...';
}

function main() {
  const script = (process.env.SCRIPT || DEFAULT_SCRIPT).replace(/\s+/g, ' ').trim() || DEFAULT_SCRIPT;
  const headlineRaw = process.env.HEADLINE || DEFAULT_HEADLINE;
  const headline = cleanDraw(truncateHeadline(headlineRaw, 58), 58);
  const ticker = cleanDraw(process.env.TICKER || DEFAULT_TICKER, 180);
  const voice = process.env.VOICE || 'en-NG-EzinneNeural';
  const voiceFallback = process.env.VOICE_FALLBACK || 'en-GB-SoniaNeural';
  const format = process.env.OUTPUT_FORMAT || 'landscape';
  const width = format === 'vertical' ? 1080 : 1920;
  const height = format === 'vertical' ? 1920 : 1080;
  const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const fontReg = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

  const outDir = path.join(process.cwd(), 'output');
  const tmpDir = path.join(process.cwd(), '.tmp_desk_brief');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  // Prefer speaking pose; fall back to idle
  const stickDir = path.join(process.cwd(), 'public', 'presenters', 'stickman');
  const poseSpeak = path.join(stickDir, 'stickman_anchor_speaking.png');
  const poseIdle = path.join(stickDir, 'stickman_anchor_idle.png');
  const pose =
    fs.existsSync(poseSpeak) ? poseSpeak : fs.existsSync(poseIdle) ? poseIdle : '';
  if (!pose) {
    console.error('No stickman pose found in', stickDir);
    process.exit(1);
  }
  console.log('Pose:', path.basename(pose));

  const narrationMp3 = path.join(tmpDir, 'narration.mp3');
  const narrationWav = path.join(tmpDir, 'narration.wav');
  const videoOut = path.join(outDir, 'desk-brief.mp4');
  const thumbOut = path.join(outDir, 'desk-brief-thumb.jpg');
  const metaOut = path.join(outDir, 'desk-brief-meta.json');

  console.log('=== 9jaBeacon Desk Brief (minimal) ===');
  console.log('Headline:', headline);
  console.log('Voice:', voice);
  console.log('Format:', format, width + 'x' + height);

  try {
    run('pip3 install --user -q edge-tts');
  } catch (_) {}
  const edgeBin =
    which('edge-tts') || path.join(process.env.HOME || '', '.local/bin/edge-tts');
  const scriptFile = path.join(tmpDir, 'script.txt');
  fs.writeFileSync(scriptFile, script, 'utf8');

  let ttsOk = false;
  for (const v of [voice, voiceFallback, 'en-US-JennyNeural']) {
    try {
      run(
        '"' +
          edgeBin +
          '" --voice "' +
          v +
          '" --rate=+0% --file "' +
          scriptFile +
          '" --write-media "' +
          narrationMp3 +
          '"'
      );
      if (fs.existsSync(narrationMp3) && fs.statSync(narrationMp3).size > 1000) {
        ttsOk = true;
        console.log('TTS OK:', v);
        break;
      }
    } catch (_) {
      console.warn('edge-tts failed:', v);
    }
  }

  let audioPath;
  if (ttsOk) {
    run(
      'ffmpeg -y -v error -i "' +
        narrationMp3 +
        '" -ar 44100 -ac 1 "' +
        narrationWav +
        '"'
    );
    audioPath = narrationWav;
  } else {
    const es = which('espeak-ng') || which('espeak');
    if (es) {
      run(
        es +
          ' -v en-gb -s 140 -w "' +
          narrationWav +
          '" "' +
          script.replace(/"/g, '') +
          '"'
      );
      audioPath = narrationWav;
    } else {
      run(
        'ffmpeg -y -v error -f lavfi -i anullsrc=r=44100:cl=mono -t 45 -c:a pcm_s16le "' +
          narrationWav +
          '"'
      );
      audioPath = narrationWav;
    }
  }

  let durationSec = 45;
  try {
    const probe = execSync(
      'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "' +
        audioPath +
        '"',
      { encoding: 'utf8' }
    ).trim();
    durationSec = Math.max(12, Math.ceil(parseFloat(probe) + 0.4));
  } catch (_) {
    durationSec = Math.max(12, Math.ceil((script.split(/\s+/).length / 140) * 60) + 2);
  }
  console.log('Duration:', durationSec, 's');

  const smH = Math.floor(height * 0.7);
  const smY = Math.floor(height * 0.08);
  const boardW = Math.floor(width * 0.22);
  const boardH = Math.floor(height * 0.4);
  const boardY = Math.floor(height * 0.12);
  const leftX = Math.floor(width * 0.04);
  const rightX = width - boardW - Math.floor(width * 0.04);
  const midW = Math.floor(width * 0.28);
  const midX = Math.floor((width - midW) / 2);
  const midY = Math.floor(height * 0.06);
  const midH = Math.floor(height * 0.26);
  const deskY = Math.floor(height * 0.58);
  const deskH = Math.floor(height * 0.22);
  const ltTop = height - 150;

  // Single-line filter_complex — no script file, no enable(), no zoompan
  // Escaping: for shell double-quotes, escape $ ` \ and use \, for ffmpeg commas in expressions
  const fc =
    // stickman
    `[1:v]scale=-1:${smH},format=rgba[sm];` +
    // base + boards
    `[0:v]` +
    `drawbox=x=0:y=0:w=${width}:h=${height}:color=0xf1f5f9:t=fill,` +
    `drawbox=x=0:y=0:w=${width}:h=${Math.floor(height * 0.55)}:color=0xe2e8f0@0.85:t=fill,` +
    `drawbox=x=${leftX}:y=${boardY}:w=${boardW}:h=${boardH}:color=0xffffff@0.35:t=fill,` +
    `drawbox=x=${leftX}:y=${boardY}:w=${boardW}:h=${boardH}:color=0x94a3b8@0.55:t=3,` +
    `drawbox=x=${rightX}:y=${boardY}:w=${boardW}:h=${boardH}:color=0xffffff@0.35:t=fill,` +
    `drawbox=x=${rightX}:y=${boardY}:w=${boardW}:h=${boardH}:color=0x94a3b8@0.55:t=3,` +
    `drawbox=x=${midX}:y=${midY}:w=${midW}:h=${midH}:color=0xffffff@0.28:t=fill,` +
    `drawbox=x=${midX}:y=${midY}:w=${midW}:h=${midH}:color=0x64748b@0.45:t=2,` +
    // board labels
    `drawtext=fontfile=${font}:text='9JA':fontcolor=0x0f172a@0.55:fontsize=42:x=${leftX + 24}:y=${boardY + 40},` +
    `drawtext=fontfile=${font}:text='BEACON':fontcolor=0xdc2626@0.7:fontsize=28:x=${leftX + 24}:y=${boardY + 90},` +
    `drawtext=fontfile=${font}:text='9JA':fontcolor=0x0f172a@0.55:fontsize=42:x=${rightX + 24}:y=${boardY + 40},` +
    `drawtext=fontfile=${font}:text='BEACON':fontcolor=0xdc2626@0.7:fontsize=28:x=${rightX + 24}:y=${boardY + 90},` +
    `drawtext=fontfile=${font}:text='9JA BEACON':fontcolor=0x0f172a@0.4:fontsize=36:x=${midX + 40}:y=${midY + Math.floor(midH / 2) - 18},` +
    // key facts / context on boards
    `drawtext=fontfile=${fontReg}:text='KEY FACTS':fontcolor=0x334155:fontsize=18:x=${leftX + 28}:y=${boardY + 160},` +
    `drawtext=fontfile=${fontReg}:text='20 rescued':fontcolor=0x0f172a:fontsize=22:x=${leftX + 28}:y=${boardY + 200},` +
    `drawtext=fontfile=${fontReg}:text='7 days':fontcolor=0x0f172a:fontsize=22:x=${leftX + 28}:y=${boardY + 240},` +
    `drawtext=fontfile=${fontReg}:text='Imo to Ibadan':fontcolor=0x0f172a:fontsize=20:x=${leftX + 28}:y=${boardY + 280},` +
    `drawtext=fontfile=${fontReg}:text='CONTEXT':fontcolor=0x334155:fontsize=18:x=${rightX + 28}:y=${boardY + 160},` +
    `drawtext=fontfile=${fontReg}:text='Southeast routes':fontcolor=0x0f172a:fontsize=20:x=${rightX + 28}:y=${boardY + 200},` +
    `drawtext=fontfile=${fontReg}:text='NYSC safety':fontcolor=0x0f172a:fontsize=20:x=${rightX + 28}:y=${boardY + 240}[bg];` +
    // stickman on studio
    `[bg][sm]overlay=x=(W-w)/2:y=${smY}[anch];` +
    // desk
    `[anch]` +
    `drawbox=x=${Math.floor(width * 0.12)}:y=${deskY}:w=${Math.floor(width * 0.76)}:h=${deskH}:color=0x1e293b:t=fill,` +
    `drawbox=x=${Math.floor(width * 0.12)}:y=${deskY}:w=${Math.floor(width * 0.76)}:h=6:color=0x334155:t=fill[desk];` +
    // lower third + brand + ticker (simple x scroll)
    `[desk]` +
    `drawbox=x=0:y=${ltTop}:w=${width}:h=70:color=0x7f1d1d:t=fill,` +
    `drawbox=x=0:y=${ltTop}:w=8:h=70:color=0xfca5a5:t=fill,` +
    `drawtext=fontfile=${font}:text='${headline}':fontcolor=white:fontsize=32:x=28:y=${ltTop + 20},` +
    `drawbox=x=0:y=${ltTop + 70}:w=${width}:h=40:color=0x991b1b:t=fill,` +
    `drawtext=fontfile=${fontReg}:text='${ticker}   ${ticker}':fontcolor=0xfef2f2:fontsize=18:x='w-mod(t*70\,w+tw)':y=${ltTop + 80},` +
    `drawbox=x=${width - 200}:y=24:w=176:h=36:color=0x0f172a@0.75:t=fill,` +
    `drawtext=fontfile=${font}:text='9JA BEACON':fontcolor=white:fontsize=16:x=${width - 188}:y=32,` +
    `format=yuv420p[vout]`;

  const fcFile = path.join(tmpDir, 'fc.txt');
  fs.writeFileSync(fcFile, fc, 'utf8');

  // Use script file BUT written as one continuous chain ending in [vout]
  // Also try -filter_complex from file via @ if needed; stick to -filter_complex_script
  run(
    'ffmpeg -y -v warning ' +
      `-f lavfi -i color=c=0xf8fafc:s=${width}x${height}:d=${durationSec} ` +
      `-loop 1 -t ${durationSec} -i "${pose}" ` +
      `-i "${audioPath}" ` +
      `-filter_complex_script "${fcFile}" ` +
      `-map "[vout]" -map 2:a ` +
      `-t ${durationSec} ` +
      `-c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 22 ` +
      `-c:a aac -b:a 160k -shortest ` +
      `"${videoOut}"`
  );

  if (!fs.existsSync(videoOut) || fs.statSync(videoOut).size < 1000) {
    console.error('MP4 missing or tiny — hard fail');
    process.exit(1);
  }

  run(
    'ffmpeg -y -v error -ss ' +
      Math.max(1, Math.floor(durationSec * 0.2)) +
      ' -i "' +
      videoOut +
      '" -vframes 1 -q:v 2 "' +
      thumbOut +
      '"'
  );

  fs.writeFileSync(
    metaOut,
    JSON.stringify(
      {
        headline: headlineRaw,
        headline_on_screen: headline,
        voice,
        format,
        durationSec,
        camera: 'none',
        studio: 'minimal_composite_single_pose',
        pose: path.basename(pose),
        video: 'output/desk-brief.mp4',
        generated_at: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log('=== DONE ===');
  console.log('MP4:', videoOut, fs.statSync(videoOut).size, 'bytes');
}

main();
