/**
 * 9jaBeacon Pro Desk Brief MP4
 * Stickman + glass boards + dynamic camera + ticker lower-third
 * Isolated from content-delivery / CF Pages.
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
  console.log('> ' + cmd.slice(0, 160) + (cmd.length > 160 ? '...' : ''));
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
  const script = (process.env.SCRIPT || DEFAULT_SCRIPT).replace(/\s+/g, ' ').trim();
  const headlineRaw = process.env.HEADLINE || DEFAULT_HEADLINE;
  const headline = cleanDraw(truncateHeadline(headlineRaw, 58), 58);
  const ticker = cleanDraw(process.env.TICKER || DEFAULT_TICKER, 220);
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
  const posePointR = path.join(stickDir, 'stickman_anchor_pointing_screen.png');
  const posePointL = path.join(stickDir, 'stickman_anchor_pointing_map.png');
  const poseBreak = path.join(stickDir, 'stickman_anchor_breaking.png');
  const poseSign = path.join(stickDir, 'stickman_anchor_signing_off.png');

  for (const p of [poseIdle, poseSpeak, posePointR, posePointL, poseBreak, poseSign]) {
    if (!fs.existsSync(p)) {
      console.error('Missing stickman asset:', p);
      process.exit(1);
    }
  }

  const narrationMp3 = path.join(tmpDir, 'narration.mp3');
  const narrationWav = path.join(tmpDir, 'narration.wav');
  const videoOut = path.join(outDir, 'desk-brief.mp4');
  const thumbOut = path.join(outDir, 'desk-brief-thumb.jpg');
  const metaOut = path.join(outDir, 'desk-brief-meta.json');

  console.log('=== 9jaBeacon Pro Desk Brief ===');
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
  const fps = 25;
  const tWide = (t * 0.08).toFixed(2);
  const tPointR = (t * 0.42).toFixed(2);
  const tBack = (t * 0.64).toFixed(2);
  const tPointL = (t * 0.72).toFixed(2);
  const tOutro = (t * 0.94).toFixed(2);

  // Frame windows for camera (on = frame index at 25fps)
  const f = (frac) => Math.floor(t * frac * fps);
  const fDesk0 = f(0.18);
  const fDesk1 = f(0.32);
  const fFace0 = f(0.32);
  const fFace1 = f(0.42);
  const fZoomR0 = f(0.48);
  const fZoomR1 = f(0.58);
  const fZoomL0 = f(0.78);
  const fZoomL1 = f(0.88);

  const smH = Math.floor(height * 0.72);
  const smY = Math.floor(height * 0.08);
  const smX = '(W-w)/2';

  const boardW = Math.floor(width * 0.22);
  const boardH = Math.floor(height * 0.42);
  const boardY = Math.floor(height * 0.12);
  const leftX = Math.floor(width * 0.04);
  const rightX = width - boardW - Math.floor(width * 0.04);
  const midW = Math.floor(width * 0.28);
  const midX = Math.floor((width - midW) / 2);
  const midY = Math.floor(height * 0.06);
  const midH = Math.floor(height * 0.28);

  const deskY = Math.floor(height * 0.58);
  const deskH = Math.floor(height * 0.22);
  const ltTop = height - 150;
  const ltHeadH = 70;
  const ltTickH = 40;

  // Balanced nested if() — each if has matching close
  // z: 4 nested ifs + sin() => five closing parens after on/40
  const cam =
    "zoompan=" +
    "z='if(between(on\\," +
    fZoomR0 +
    "\\," +
    fZoomR1 +
    "),2.1,if(between(on\\," +
    fZoomL0 +
    "\\," +
    fZoomL1 +
    "),2.1,if(between(on\\," +
    fDesk0 +
    "\\," +
    fDesk1 +
    "),1.35,if(between(on\\," +
    fFace0 +
    "\\," +
    fFace1 +
    "),1.55,1.0+0.08*sin(on/40)))))':" +
    "x='if(between(on\\," +
    fZoomR0 +
    "\\," +
    fZoomR1 +
    "),iw*0.55,if(between(on\\," +
    fZoomL0 +
    "\\," +
    fZoomL1 +
    "),iw*0.02,(iw-iw/zoom)/2))':" +
    "y='if(between(on\\," +
    fFace0 +
    "\\," +
    fFace1 +
    "),ih*0.05,(ih-ih/zoom)/2)':" +
    "d=1:s=" +
    width +
    "x" +
    height +
    ":fps=" +
    fps;

  const parts = [];

  parts.push(
    '[0:v]drawbox=x=0:y=0:w=' +
      width +
      ':h=' +
      height +
      ':color=0xf1f5f9:t=fill,' +
      'drawbox=x=0:y=0:w=' +
      width +
      ':h=' +
      Math.floor(height * 0.55) +
      ':color=0xe2e8f0@0.85:t=fill,' +
      'drawbox=x=0:y=' +
      Math.floor(height * 0.55) +
      ':w=' +
      width +
      ':h=' +
      Math.floor(height * 0.45) +
      ':color=0xcbd5e1@0.9:t=fill[base]'
  );

  parts.push(
    '[base]' +
      'drawbox=x=' +
      leftX +
      ':y=' +
      boardY +
      ':w=' +
      boardW +
      ':h=' +
      boardH +
      ':color=0xffffff@0.35:t=fill,' +
      'drawbox=x=' +
      leftX +
      ':y=' +
      boardY +
      ':w=' +
      boardW +
      ':h=' +
      boardH +
      ':color=0x94a3b8@0.55:t=3,' +
      'drawbox=x=' +
      rightX +
      ':y=' +
      boardY +
      ':w=' +
      boardW +
      ':h=' +
      boardH +
      ':color=0xffffff@0.35:t=fill,' +
      'drawbox=x=' +
      rightX +
      ':y=' +
      boardY +
      ':w=' +
      boardW +
      ':h=' +
      boardH +
      ':color=0x94a3b8@0.55:t=3,' +
      'drawbox=x=' +
      midX +
      ':y=' +
      midY +
      ':w=' +
      midW +
      ':h=' +
      midH +
      ':color=0xffffff@0.28:t=fill,' +
      'drawbox=x=' +
      midX +
      ':y=' +
      midY +
      ':w=' +
      midW +
      ':h=' +
      midH +
      ':color=0x64748b@0.45:t=2[boards]'
  );

  parts.push(
    '[boards]' +
      'drawtext=fontfile=' +
      font +
      ":text='9JA':fontcolor=0x0f172a@0.55:fontsize=42:x=" +
      (leftX + 24) +
      ':y=' +
      (boardY + 40) +
      ',' +
      'drawtext=fontfile=' +
      font +
      ":text='BEACON':fontcolor=0xdc2626@0.7:fontsize=28:x=" +
      (leftX + 24) +
      ':y=' +
      (boardY + 90) +
      ',' +
      'drawtext=fontfile=' +
      font +
      ":text='9JA':fontcolor=0x0f172a@0.55:fontsize=42:x=" +
      (rightX + 24) +
      ':y=' +
      (boardY + 40) +
      ',' +
      'drawtext=fontfile=' +
      font +
      ":text='BEACON':fontcolor=0xdc2626@0.7:fontsize=28:x=" +
      (rightX + 24) +
      ':y=' +
      (boardY + 90) +
      ',' +
      'drawtext=fontfile=' +
      font +
      ":text='9JA BEACON':fontcolor=0x0f172a@0.4:fontsize=36:x=" +
      (midX + 40) +
      ':y=' +
      (midY + Math.floor(midH / 2) - 18) +
      '[branded]'
  );

  parts.push(
    '[branded]' +
      'drawbox=x=' +
      (leftX + 12) +
      ':y=' +
      (boardY + 140) +
      ':w=' +
      (boardW - 24) +
      ':h=' +
      (boardH - 160) +
      ':color=0x0f172a@0.12:t=fill,' +
      'drawtext=fontfile=' +
      fontReg +
      ":text='KEY FACTS':fontcolor=0x334155:fontsize=18:x=" +
      (leftX + 28) +
      ':y=' +
      (boardY + 160) +
      ',' +
      'drawtext=fontfile=' +
      fontReg +
      ":text='20 rescued':fontcolor=0x0f172a:fontsize=22:x=" +
      (leftX + 28) +
      ':y=' +
      (boardY + 200) +
      ',' +
      'drawtext=fontfile=' +
      fontReg +
      ":text='7 days':fontcolor=0x0f172a:fontsize=22:x=" +
      (leftX + 28) +
      ':y=' +
      (boardY + 240) +
      ',' +
      'drawtext=fontfile=' +
      fontReg +
      ":text='Imo to Ibadan':fontcolor=0x0f172a:fontsize=20:x=" +
      (leftX + 28) +
      ':y=' +
      (boardY + 280) +
      ',' +
      'drawbox=x=' +
      (rightX + 12) +
      ':y=' +
      (boardY + 140) +
      ':w=' +
      (boardW - 24) +
      ':h=' +
      (boardH - 160) +
      ':color=0x0f172a@0.12:t=fill,' +
      'drawtext=fontfile=' +
      fontReg +
      ":text='CONTEXT':fontcolor=0x334155:fontsize=18:x=" +
      (rightX + 28) +
      ':y=' +
      (boardY + 160) +
      ',' +
      'drawtext=fontfile=' +
      fontReg +
      ":text='Southeast routes':fontcolor=0x0f172a:fontsize=20:x=" +
      (rightX + 28) +
      ':y=' +
      (boardY + 200) +
      ',' +
      'drawtext=fontfile=' +
      fontReg +
      ":text='NYSC safety':fontcolor=0x0f172a:fontsize=20:x=" +
      (rightX + 28) +
      ':y=' +
      (boardY + 240) +
      '[screens]'
  );

  parts.push('[1:v]scale=-1:' + smH + '[p_idle]');
  parts.push('[2:v]scale=-1:' + smH + '[p_speak]');
  parts.push('[3:v]scale=-1:' + smH + '[p_pr]');
  parts.push('[4:v]scale=-1:' + smH + '[p_pl]');
  parts.push('[5:v]scale=-1:' + smH + '[p_brk]');
  parts.push('[6:v]scale=-1:' + smH + '[p_sign]');

  parts.push(
    '[screens][p_idle]overlay=x=' + smX + ':y=' + smY + ":enable='lt(t\\," + tWide + ")'[s1]"
  );
  parts.push(
    '[s1][p_speak]overlay=x=' +
      smX +
      ':y=' +
      smY +
      ":enable='between(t\\," +
      tWide +
      "\\," +
      tPointR +
      ")*lt(mod(t*3.5\\,1)\\,0.55)'[s2]"
  );
  parts.push(
    '[s2][p_idle]overlay=x=' +
      smX +
      ':y=' +
      smY +
      ":enable='between(t\\," +
      tWide +
      "\\," +
      tPointR +
      ")*gte(mod(t*3.5\\,1)\\,0.55)'[s3]"
  );
  parts.push(
    '[s3][p_pr]overlay=x=' +
      smX +
      ':y=' +
      smY +
      ":enable='between(t\\," +
      tPointR +
      "\\," +
      tBack +
      ")'[s4]"
  );
  parts.push(
    '[s4][p_speak]overlay=x=' +
      smX +
      ':y=' +
      smY +
      ":enable='between(t\\," +
      tBack +
      "\\," +
      tPointL +
      ")'[s5]"
  );
  parts.push(
    '[s5][p_pl]overlay=x=' +
      smX +
      ':y=' +
      smY +
      ":enable='between(t\\," +
      tPointL +
      "\\," +
      tOutro +
      ")'[s6]"
  );
  parts.push(
    '[s6][p_sign]overlay=x=' +
      smX +
      ':y=' +
      smY +
      ":enable='gte(t\\," +
      tOutro +
      ")'[anchor]"
  );

  parts.push(
    '[anchor]' +
      'drawbox=x=' +
      Math.floor(width * 0.12) +
      ':y=' +
      deskY +
      ':w=' +
      Math.floor(width * 0.76) +
      ':h=' +
      deskH +
      ':color=0x1e293b:t=fill,' +
      'drawbox=x=' +
      Math.floor(width * 0.12) +
      ':y=' +
      deskY +
      ':w=' +
      Math.floor(width * 0.76) +
      ':h=6:color=0x334155:t=fill,' +
      'drawbox=x=' +
      Math.floor(width * 0.35) +
      ':y=' +
      (deskY + 18) +
      ':w=' +
      Math.floor(width * 0.3) +
      ':h=10:color=0x0f172a:t=fill[desk]'
  );

  parts.push(
    '[desk]' +
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
      'drawtext=fontfile=' +
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
      'drawtext=fontfile=' +
      fontReg +
      ":text='" +
      ticker +
      '     ' +
      ticker +
      "':fontcolor=0xfef2f2:fontsize=18:x='w-mod(t*80\\,w+tw)':y=" +
      (ltTop + ltHeadH + 10) +
      '[lt]'
  );

  parts.push(
    '[lt]' +
      'drawbox=x=' +
      (width - 200) +
      ':y=24:w=176:h=36:color=0x0f172a@0.75:t=fill,' +
      'drawtext=fontfile=' +
      font +
      ":text='9JA BEACON':fontcolor=white:fontsize=16:x=" +
      (width - 188) +
      ':y=32[comp]'
  );

  parts.push('[comp]' + cam + '[vout]');

  const fcFile = path.join(tmpDir, 'fc.txt');
  fs.writeFileSync(fcFile, parts.join(';\n'));

  run(
    'ffmpeg -y -v error ' +
      '-f lavfi -i color=c=0xf8fafc:s=' +
      width +
      'x' +
      height +
      ':d=' +
      durationSec +
      ' ' +
      '-loop 1 -t ' +
      durationSec +
      ' -i "' +
      poseIdle +
      '" ' +
      '-loop 1 -t ' +
      durationSec +
      ' -i "' +
      poseSpeak +
      '" ' +
      '-loop 1 -t ' +
      durationSec +
      ' -i "' +
      posePointR +
      '" ' +
      '-loop 1 -t ' +
      durationSec +
      ' -i "' +
      posePointL +
      '" ' +
      '-loop 1 -t ' +
      durationSec +
      ' -i "' +
      poseBreak +
      '" ' +
      '-loop 1 -t ' +
      durationSec +
      ' -i "' +
      poseSign +
      '" ' +
      '-i "' +
      audioPath +
      '" ' +
      '-filter_complex_script "' +
      fcFile +
      '" ' +
      '-map "[vout]" -map 7:a ' +
      '-t ' +
      durationSec +
      ' ' +
      '-c:v libx264 -pix_fmt yuv420p -preset fast -crf 20 ' +
      '-c:a aac -b:a 192k -shortest ' +
      '"' +
      videoOut +
      '"'
  );

  run(
    'ffmpeg -y -v error -ss ' +
      (t * 0.25).toFixed(1) +
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
        camera: 'pro_dynamic_zoom_side_screens',
        studio: 'white_glass_boards_desk_stickman',
        video: 'output/desk-brief.mp4',
        generated_at: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log('=== DONE ===');
  console.log(
    'MP4:',
    videoOut,
    fs.existsSync(videoOut) ? fs.statSync(videoOut).size + ' bytes' : 'MISSING'
  );
}

main();
