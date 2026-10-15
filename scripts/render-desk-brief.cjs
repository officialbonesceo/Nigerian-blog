/**
 * 9jaBeacon Desk Brief MP4
 * Isolated from site + content-delivery.
 *
 * Stickman PNGs already contain the dark newsroom, curved desk, ON AIR,
 * gold stickman + headset. We scale those full-frame and only composite:
 *  - idle ↔ speaking flicker (mouth motion)
 *  - optional point poses mid-script
 *  - red headline bar + scrolling ticker (the bits you liked)
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
  const script =
    (process.env.SCRIPT || DEFAULT_SCRIPT).replace(/\s+/g, ' ').trim() || DEFAULT_SCRIPT;
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

  const stickDir = path.join(process.cwd(), 'public', 'presenters', 'stickman');
  const poseIdle = path.join(stickDir, 'stickman_anchor_idle.png');
  const poseSpeak = path.join(stickDir, 'stickman_anchor_speaking.png');
  const posePoint = path.join(stickDir, 'stickman_anchor_pointing_screen.png');
  const poseSign = path.join(stickDir, 'stickman_anchor_signing_off.png');

  for (const p of [poseIdle, poseSpeak]) {
    if (!fs.existsSync(p)) {
      console.error('Missing required pose:', p);
      process.exit(1);
    }
  }
  const hasPoint = fs.existsSync(posePoint);
  const hasSign = fs.existsSync(poseSign);

  const narrationMp3 = path.join(tmpDir, 'narration.mp3');
  const narrationWav = path.join(tmpDir, 'narration.wav');
  const videoOut = path.join(outDir, 'desk-brief.mp4');
  const thumbOut = path.join(outDir, 'desk-brief-thumb.jpg');
  const metaOut = path.join(outDir, 'desk-brief-meta.json');

  console.log('=== 9jaBeacon Desk Brief (full-frame stickman studio) ===');
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

  const t = durationSec;
  // Timeline: talk most of the way, brief point mid, sign-off at end
  const tPoint0 = (t * 0.45).toFixed(2);
  const tPoint1 = (t * 0.58).toFixed(2);
  const tSign = (t * 0.92).toFixed(2);

  const ltTop = height - 150;
  const ltHeadH = 70;
  const ltTickH = 40;

  // Full-frame poses: scale+pad to cover 1920x1080 (PNG is square studio)
  // Mouth motion: speaking over idle with enable on mod(t)
  // Point / sign when assets exist
  let fc =
    `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=rgba[idle];` +
    `[2:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=rgba[speak];`;

  let nextIn = 3;
  if (hasPoint) {
    fc +=
      `[${nextIn}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=rgba[point];`;
    nextIn++;
  }
  if (hasSign) {
    fc +=
      `[${nextIn}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=rgba[sign];`;
    nextIn++;
  }

  // Base = idle full duration
  // Speaking flickers on top during talk windows (mouth open/closed)
  // Point mid-script; sign-off at end
  fc +=
    `[0:v][idle]overlay=0:0[base];` +
    `[base][speak]overlay=0:0:enable='lt(t\\,${tPoint0})*lt(mod(t*5\\,1)\\,0.55)+between(t\\,${tPoint1}\\,${tSign})*lt(mod(t*5\\,1)\\,0.55)'[talk];`;

  if (hasPoint) {
    fc +=
      `[talk][point]overlay=0:0:enable='between(t\\,${tPoint0}\\,${tPoint1})'[posed];`;
  } else {
    fc += `[talk]copy[posed];`;
  }

  if (hasSign) {
    fc +=
      `[posed][sign]overlay=0:0:enable='gte(t\\,${tSign})'[stage];`;
  } else {
    fc += `[posed]copy[stage];`;
  }

  // Lower-third only (keep what you liked)
  fc +=
    `[stage]` +
    `drawbox=x=0:y=${ltTop}:w=${width}:h=${ltHeadH}:color=0x7f1d1d:t=fill,` +
    `drawbox=x=0:y=${ltTop}:w=8:h=${ltHeadH}:color=0xfca5a5:t=fill,` +
    `drawtext=fontfile=${font}:text='${headline}':fontcolor=white:fontsize=32:x=28:y=${ltTop + 20},` +
    `drawbox=x=0:y=${ltTop + ltHeadH}:w=${width}:h=${ltTickH}:color=0x991b1b:t=fill,` +
    `drawtext=fontfile=${fontReg}:text='${ticker}   ${ticker}':fontcolor=0xfef2f2:fontsize=18:x='w-mod(t*70\\,w+tw)':y=${ltTop + ltHeadH + 10},` +
    `format=yuv420p[vout]`;

  const fcFile = path.join(tmpDir, 'fc.txt');
  fs.writeFileSync(fcFile, fc, 'utf8');

  // Inputs: 0 = dark studio color (fallback underlay), 1 idle, 2 speak, [3 point], [4 sign], last = audio
  let inputArgs =
    `-f lavfi -i color=c=0x030712:s=${width}x${height}:d=${durationSec} ` +
    `-loop 1 -t ${durationSec} -i "${poseIdle}" ` +
    `-loop 1 -t ${durationSec} -i "${poseSpeak}" `;
  if (hasPoint) inputArgs += `-loop 1 -t ${durationSec} -i "${posePoint}" `;
  if (hasSign) inputArgs += `-loop 1 -t ${durationSec} -i "${poseSign}" `;
  inputArgs += `-i "${audioPath}" `;

  const audioMapIndex = 3 + (hasPoint ? 1 : 0) + (hasSign ? 1 : 0);

  run(
    'ffmpeg -y -v warning ' +
      inputArgs +
      `-filter_complex_script "${fcFile}" ` +
      `-map "[vout]" -map ${audioMapIndex}:a ` +
      `-t ${durationSec} ` +
      `-c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 22 ` +
      `-c:a aac -b:a 160k -shortest ` +
      `"${videoOut}"`
  );

  if (!fs.existsSync(videoOut) || fs.statSync(videoOut).size < 1000) {
    console.error('MP4 missing or tiny');
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
        studio: 'full_frame_stickman_png',
        motion: 'idle_speak_flicker_point_sign',
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
