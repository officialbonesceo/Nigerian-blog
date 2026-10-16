/**
 * 9jaBeacon Desk Brief MP4
 * Landscape poses (desk fills lower ~half). Slow human-paced gestures + tablet reads.
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

function svgToPng(svgPath, pngPath, w, h) {
  const rsvg = which('rsvg-convert');
  if (rsvg) {
    run('"' + rsvg + '" -w ' + w + ' -h ' + h + ' -o "' + pngPath + '" "' + svgPath + '"');
    return;
  }
  const convert = which('convert') || which('magick');
  if (convert) {
    run('"' + convert + '" -background none -resize ' + w + 'x' + h + ' "' + svgPath + '" "' + pngPath + '"');
    return;
  }
  throw new Error('Need rsvg-convert or ImageMagick');
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
  // Landscape 16:9 poses — desk fills lower portion of frame
  const names = ['bw_idle', 'bw_speaking', 'bw_tablet', 'bw_look_right', 'bw_blink'];
  const pngs = {};
  for (const n of names) {
    const svg = path.join(stickDir, n + '.svg');
    if (!fs.existsSync(svg)) {
      if (n === 'bw_idle' || n === 'bw_speaking') {
        console.error('Missing required', svg);
        process.exit(1);
      }
      continue;
    }
    const png = path.join(tmpDir, n + '.png');
    svgToPng(svg, png, width, height);
    pngs[n] = png;
  }

  const hasTablet = !!pngs.bw_tablet;
  const hasRight = !!pngs.bw_look_right;
  const hasBlink = !!pngs.bw_blink;

  const narrationMp3 = path.join(tmpDir, 'narration.mp3');
  const narrationWav = path.join(tmpDir, 'narration.wav');
  const videoOut = path.join(outDir, 'desk-brief.mp4');
  const thumbOut = path.join(outDir, 'desk-brief-thumb.jpg');
  const metaOut = path.join(outDir, 'desk-brief-meta.json');

  console.log('=== 9jaBeacon Desk Brief (human pace + tablet + desk frame) ===');
  console.log('Headline:', headline);
  console.log('Poses:', Object.keys(pngs).join(', '));

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
        '"' + edgeBin + '" --voice "' + v + '" --rate=+0% --file "' + scriptFile + '" --write-media "' + narrationMp3 + '"'
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
    run('ffmpeg -y -v error -i "' + narrationMp3 + '" -ar 44100 -ac 1 "' + narrationWav + '"');
    audioPath = narrationWav;
  } else {
    const es = which('espeak-ng') || which('espeak');
    if (es) {
      run(es + ' -v en-gb -s 140 -w "' + narrationWav + '" "' + script.replace(/"/g, '') + '"');
      audioPath = narrationWav;
    } else {
      run('ffmpeg -y -v error -f lavfi -i anullsrc=r=44100:cl=mono -t 45 -c:a pcm_s16le "' + narrationWav + '"');
      audioPath = narrationWav;
    }
  }

  let durationSec = 45;
  try {
    const probe = execSync(
      'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "' + audioPath + '"',
      { encoding: 'utf8' }
    ).trim();
    durationSec = Math.max(12, Math.ceil(parseFloat(probe) + 0.4));
  } catch (_) {
    durationSec = Math.max(12, Math.ceil((script.split(/\s+/).length / 140) * 60) + 2);
  }
  console.log('Duration:', durationSec, 's');

  const t = durationSec;
  // HUMAN pacing — long holds, rare switches (not twitchy)
  // tablet glance ~12–22%
  const tab0 = (t * 0.12).toFixed(2);
  const tab1 = (t * 0.22).toFixed(2);
  // mild speaking hand hold ~30–42%
  const hand0 = (t * 0.3).toFixed(2);
  const hand1 = (t * 0.42).toFixed(2);
  // look/point right ~58–72%
  const look0 = (t * 0.58).toFixed(2);
  const look1 = (t * 0.72).toFixed(2);
  // second tablet check near end ~82–90%
  const tab2 = (t * 0.82).toFixed(2);
  const tab3 = (t * 0.9).toFixed(2);

  const ltTop = height - 150;
  const ltHeadH = 70;
  const ltTickH = 40;

  // Full-bleed landscape frames (already 16:9)
  const fit = 'scale=' + width + ':' + height + ':force_original_aspect_ratio=decrease,pad=' + width + ':' + height + ':(ow-iw)/2:(oh-ih)/2:color=0xf1f5f9,format=rgba';

  let idx = 1;
  const idIdle = idx++;
  const idSpeak = idx++;
  let idTablet = -1,
    idRight = -1,
    idBlink = -1;
  if (hasTablet) idTablet = idx++;
  if (hasRight) idRight = idx++;
  if (hasBlink) idBlink = idx++;
  const idAudio = idx;

  let fc = '';
  fc += '[' + idIdle + ':v]' + fit + '[idle];';
  fc += '[' + idSpeak + ':v]' + fit + '[speak];';
  if (hasTablet) fc += '[' + idTablet + ':v]' + fit + '[tablet];';
  if (hasRight) fc += '[' + idRight + ':v]' + fit + '[lookR];';
  if (hasBlink) fc += '[' + idBlink + ':v]' + fit + '[blink];';

  // Base always idle (hands rest)
  fc += '[0:v][idle]overlay=0:0[base];';

  // Slow mouth-only flicker on idle body most of the time
  // (speaking pose only during dedicated hand window so hands don't twitch)
  // Mouth: use speak overlay with SLOW duty cycle outside gesture holds
  const busy =
    "*not(between(t\\," +
    tab0 +
    "\\," +
    tab1 +
    "))*not(between(t\\," +
    hand0 +
    "\\," +
    hand1 +
    "))*not(between(t\\," +
    look0 +
    "\\," +
    look1 +
    "))*not(between(t\\," +
    tab2 +
    "\\," +
    tab3 +
    "))";

  // Mouth open ~0.4s every ~1.1s (slower, human-ish lip cycle)
  fc +=
    "[base][speak]overlay=0:0:enable='lt(mod(t*1.8\\,1)\\,0.38)" +
    busy +
    "'[mouth];";

  // Dedicated hand-raise speaking hold (one continuous 12% of video — not flicker)
  fc +=
    "[mouth][speak]overlay=0:0:enable='between(t\\," +
    hand0 +
    "\\," +
    hand1 +
    ")'[hand];";

  let cur = 'hand';
  if (hasTablet) {
    fc +=
      '[' +
      cur +
      "][tablet]overlay=0:0:enable='between(t\\," +
      tab0 +
      "\\," +
      tab1 +
      ")+between(t\\," +
      tab2 +
      "\\," +
      tab3 +
      ")'[tab];";
    cur = 'tab';
  }
  if (hasRight) {
    fc +=
      '[' +
      cur +
      "][lookR]overlay=0:0:enable='between(t\\," +
      look0 +
      "\\," +
      look1 +
      ")'[look];";
    cur = 'look';
  }
  if (hasBlink) {
    // Blink ~every 4.5s for 0.12s only
    fc +=
      '[' +
      cur +
      "][blink]overlay=0:0:enable='gte(t\\,2)*lt(mod(t\\,4.5)\\,0.12)'[stage];";
    cur = 'stage';
  } else {
    fc += '[' + cur + ']copy[stage];';
    cur = 'stage';
  }

  fc +=
    '[stage]' +
    'drawbox=x=0:y=' +
    ltTop +
    ':w=' +
    width +
    ':h=' +
    ltHeadH +
    ':color=0x7f1d1d:t=fill,' +
    'drawbox=x=0:y=' +
    ltTop +
    ':w=8:h=' +
    ltHeadH +
    ':color=0xfca5a5:t=fill,' +
    "drawtext=fontfile=" +
    font +
    ":text='" +
    headline +
    "':fontcolor=white:fontsize=32:x=28:y=" +
    (ltTop + 20) +
    ',' +
    'drawbox=x=0:y=' +
    (ltTop + ltHeadH) +
    ':w=' +
    width +
    ':h=' +
    ltTickH +
    ':color=0x991b1b:t=fill,' +
    "drawtext=fontfile=" +
    fontReg +
    ":text='" +
    ticker +
    '   ' +
    ticker +
    "':fontcolor=0xfef2f2:fontsize=18:x='w-mod(t*70\\,w+tw)':y=" +
    (ltTop + ltHeadH + 10) +
    ',format=yuv420p[vout]';

  const fcFile = path.join(tmpDir, 'fc.txt');
  fs.writeFileSync(fcFile, fc, 'utf8');

  let inputArgs =
    '-f lavfi -i color=c=0xf1f5f9:s=' +
    width +
    'x' +
    height +
    ':d=' +
    durationSec +
    ' ' +
    '-loop 1 -t ' +
    durationSec +
    ' -i "' +
    pngs.bw_idle +
    '" ' +
    '-loop 1 -t ' +
    durationSec +
    ' -i "' +
    pngs.bw_speaking +
    '" ';
  if (hasTablet) inputArgs += '-loop 1 -t ' + durationSec + ' -i "' + pngs.bw_tablet + '" ';
  if (hasRight) inputArgs += '-loop 1 -t ' + durationSec + ' -i "' + pngs.bw_look_right + '" ';
  if (hasBlink) inputArgs += '-loop 1 -t ' + durationSec + ' -i "' + pngs.bw_blink + '" ';
  inputArgs += '-i "' + audioPath + '" ';

  run(
    'ffmpeg -y -v warning ' +
      inputArgs +
      '-filter_complex_script "' +
      fcFile +
      '" ' +
      '-map "[vout]" -map ' +
      idAudio +
      ':a ' +
      '-t ' +
      durationSec +
      ' ' +
      '-c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 22 ' +
      '-c:a aac -b:a 160k -shortest ' +
      '"' +
      videoOut +
      '"'
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
        voice,
        format,
        durationSec,
        motion: 'slow_mouth_tablet_reads_hand_hold_look_right_blink',
        framing: 'landscape_desk_lower_half',
        poses: Object.keys(pngs),
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
