/**
 * 9jaBeacon Desk Brief MP4 renderer
 * Isolated from content-delivery / site deploy.
 * Input: env SCRIPT, HEADLINE, VOICE (optional)
 * Output: output/desk-brief.mp4 + output/desk-brief-thumb.jpg
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const DEFAULT_SCRIPT =
  'Good evening. This is 9jaBeacon. We start with breaking news from the Southeast. Twenty prospective National Youth Service Corps members, abducted in Imo State, have been rescued after a week in captivity. The graduates were seized while travelling in Imo, a state that has seen a rise in kidnapping-for-ransom along major routes. After seven days in the hands of their abductors, all twenty regained their freedom. Here is what we know. Twenty prospective corps members. Seven days in captivity. Abducted in Imo State. Reunited with their families in Ibadan, the Oyo State capital. Security agencies have not released full operational details of the rescue. The case renews urgent questions about the safety of young Nigerians travelling to NYSC orientation camps, especially through high-risk corridors in the Southeast. For now, the families have their children back. The bigger picture remains clear: Nigeria must secure the roads that take our graduates to service. We will continue to follow this story. This is 9jaBeacon. Stay informed. Subscribe for more.';

const DEFAULT_HEADLINE = 'NYSC MEMBERS RESCUED AFTER WEEK IN CAPTIVITY';

function run(cmd, opts = {}) {
  console.log('> ' + cmd.slice(0, 120) + (cmd.length > 120 ? '...' : ''));
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function which(bin) {
  try {
    return execSync('which ' + bin, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function cleanDraw(s) {
  return String(s || '')
    .replace(/[:\\'%]/g, ' ')
    .replace(/"/g, '')
    .trim()
    .slice(0, 90);
}

async function main() {
  const script = (process.env.SCRIPT || DEFAULT_SCRIPT).replace(/\s+/g, ' ').trim();
  const headline = cleanDraw(process.env.HEADLINE || DEFAULT_HEADLINE);
  const voice = process.env.VOICE || 'en-NG-EzinneNeural';
  const voiceFallback = process.env.VOICE_FALLBACK || 'en-GB-SoniaNeural';
  const format = process.env.OUTPUT_FORMAT || 'landscape'; // landscape | vertical
  const width = format === 'vertical' ? 1080 : 1920;
  const height = format === 'vertical' ? 1920 : 1080;

  const outDir = path.join(process.cwd(), 'output');
  const tmpDir = path.join(process.cwd(), '.tmp_desk_brief');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  const narrationMp3 = path.join(tmpDir, 'narration.mp3');
  const narrationWav = path.join(tmpDir, 'narration.wav');
  const videoOut = path.join(outDir, 'desk-brief.mp4');
  const thumbOut = path.join(outDir, 'desk-brief-thumb.jpg');
  const metaOut = path.join(outDir, 'desk-brief-meta.json');

  console.log('=== 9jaBeacon Desk Brief Renderer ===');
  console.log('Headline:', headline);
  console.log('Voice:', voice);
  console.log('Format:', format, width + 'x' + height);
  console.log('Script words:', script.split(/\s+/).length);

  // --- TTS ---
  let audioPath = null;
  const edgeOk = which('edge-tts') || which('edge-tts.exe');
  if (!edgeOk) {
    try {
      run('pip3 install --user -q edge-tts');
    } catch (e) {
      console.warn('pip edge-tts install failed, will try espeak');
    }
  }

  const edgeBin = which('edge-tts') || path.join(process.env.HOME || '', '.local/bin/edge-tts');
  let ttsOk = false;
  for (const v of [voice, voiceFallback, 'en-US-JennyNeural']) {
    try {
      const scriptFile = path.join(tmpDir, 'script.txt');
      fs.writeFileSync(scriptFile, script, 'utf8');
      run(
        `"${edgeBin}" --voice "${v}" --rate=+0% --file "${scriptFile}" --write-media "${narrationMp3}"`
      );
      if (fs.existsSync(narrationMp3) && fs.statSync(narrationMp3).size > 1000) {
        ttsOk = true;
        console.log('TTS OK with voice', v);
        break;
      }
    } catch (e) {
      console.warn('edge-tts failed for', v, e.message || e);
    }
  }

  if (!ttsOk) {
    const es = which('espeak') || which('espeak-ng');
    if (es) {
      run(`${es} -v en-gb -s 140 -w "${narrationWav}" "${script.replace(/"/g, '')}"`);
      audioPath = narrationWav;
    } else {
      // silence bed so video still renders
      run(
        `ffmpeg -y -v error -f lavfi -i anullsrc=r=44100:cl=mono -t 45 -c:a pcm_s16le "${narrationWav}"`
      );
      audioPath = narrationWav;
      console.warn('No TTS available — silent video');
    }
  } else {
    run(`ffmpeg -y -v error -i "${narrationMp3}" -ar 44100 -ac 1 "${narrationWav}"`);
    audioPath = narrationWav;
  }

  // duration from audio
  let durationSec = 45;
  try {
    const probe = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`,
      { encoding: 'utf8' }
    ).trim();
    durationSec = Math.max(8, Math.ceil(parseFloat(probe) + 0.5));
  } catch {
    durationSec = Math.max(8, Math.ceil((script.split(/\s+/).length / 140) * 60) + 2);
  }
  console.log('Duration:', durationSec, 's');

  // --- Visual: branded lower-thirds + logo plate (no puppet assets required) ---
  const safeH = cleanDraw(headline);
  const filter = [
    `color=c=0x070b14:s=${width}x${height}:d=${durationSec}[bg]`,
    // subtle grid
    `[bg]drawgrid=w=80:h=80:t=1:c=0x1e293b@0.35[g]`,
    // top bar
    `[g]drawbox=x=0:y=0:w=${width}:h=72:color=0x0f172a@0.95:t=fill[tb]`,
    `[tb]drawtext=text='9JA BEACON':fontcolor=white:fontsize=28:x=48:y=22[logo]`,
    `[logo]drawbox=x=260:y=18:w=70:h=36:color=0xdc2626:t=fill[liveb]`,
    `[liveb]drawtext=text='LIVE':fontcolor=white:fontsize=20:x=272:y=26[live]`,
    // center plate
    `[live]drawbox=x=${Math.floor(width * 0.08)}:y=${Math.floor(height * 0.28)}:w=${Math.floor(width * 0.84)}:h=${Math.floor(height * 0.22)}:color=0x0f172a@0.88:t=fill[plate]`,
    `[plate]drawtext=text='DESK BRIEF':fontcolor=0x94a3b8:fontsize=22:x=${Math.floor(width * 0.1)}:y=${Math.floor(height * 0.3)}[tag]`,
    `[tag]drawtext=text='${safeH}':fontcolor=white:fontsize=36:x=${Math.floor(width * 0.1)}:y=${Math.floor(height * 0.36)}[hl]`,
    // breaking badge + lower third
    `[hl]drawbox=x=48:y=${height - 200}:w=220:h=40:color=0xdc2626:t=fill[brk]`,
    `[brk]drawtext=text='BREAKING NEWS':fontcolor=white:fontsize=18:x=64:y=${height - 190}[brkt]`,
    `[brkt]drawbox=x=48:y=${height - 158}:w=${width - 96}:h=64:color=0x0f172a@0.96:t=fill[lt]`,
    `[lt]drawtext=text='${safeH}':fontcolor=white:fontsize=26:x=64:y=${height - 138}[ltt]`,
    `[ltt]drawbox=x=48:y=${height - 92}:w=${width - 96}:h=40:color=0x020617@0.96:t=fill[sub]`,
    `[sub]drawtext=text='www.9jabeacon.name.ng  |  Real News · Real Time · For You':fontcolor=0x94a3b8:fontsize=18:x=64:y=${height - 80}[v]`,
  ].join(';');

  run(
    `ffmpeg -y -v error -f lavfi -i "${filter.split('[v]')[0]}nullsrc=s=${width}x${height}:d=${durationSec}[x];[x]null[v]" -t ${durationSec} -f null -` +
      ' 2>/dev/null || true'
  );

  // Build video properly
  const fcFile = path.join(tmpDir, 'fc.txt');
  // simpler single filter_complex without the null test
  const fc = [
    `[0:v]drawgrid=w=80:h=80:t=1:c=0x1e293b@0.35,` +
      `drawbox=x=0:y=0:w=${width}:h=72:color=0x0f172a@0.95:t=fill,` +
      `drawtext=text='9JA BEACON':fontcolor=white:fontsize=28:x=48:y=22,` +
      `drawbox=x=260:y=18:w=70:h=36:color=0xdc2626:t=fill,` +
      `drawtext=text='LIVE':fontcolor=white:fontsize=20:x=272:y=26,` +
      `drawbox=x=${Math.floor(width * 0.08)}:y=${Math.floor(height * 0.28)}:w=${Math.floor(width * 0.84)}:h=${Math.floor(height * 0.22)}:color=0x0f172a@0.88:t=fill,` +
      `drawtext=text='DESK BRIEF':fontcolor=0x94a3b8:fontsize=22:x=${Math.floor(width * 0.1)}:y=${Math.floor(height * 0.3)},` +
      `drawtext=text='${safeH}':fontcolor=white:fontsize=34:x=${Math.floor(width * 0.1)}:y=${Math.floor(height * 0.37)},` +
      `drawbox=x=48:y=${height - 200}:w=220:h=40:color=0xdc2626:t=fill,` +
      `drawtext=text='BREAKING NEWS':fontcolor=white:fontsize=18:x=64:y=${height - 190},` +
      `drawbox=x=48:y=${height - 158}:w=${width - 96}:h=64:color=0x0f172a@0.96:t=fill,` +
      `drawtext=text='${safeH}':fontcolor=white:fontsize=26:x=64:y=${height - 138},` +
      `drawbox=x=48:y=${height - 92}:w=${width - 96}:h=40:color=0x020617@0.96:t=fill,` +
      `drawtext=text='www.9jabeacon.name.ng  |  Real News · Real Time · For You':fontcolor=0x94a3b8:fontsize=18:x=64:y=${height - 80}[vout]`,
  ].join('');
  fs.writeFileSync(fcFile, fc);

  run(
    `ffmpeg -y -v error ` +
      `-f lavfi -i color=c=0x070b14:s=${width}x${height}:d=${durationSec} ` +
      `-i "${audioPath}" ` +
      `-filter_complex_script "${fcFile}" ` +
      `-map "[vout]" -map 1:a ` +
      `-t ${durationSec} ` +
      `-c:v libx264 -pix_fmt yuv420p -preset fast -crf 22 ` +
      `-c:a aac -b:a 192k -shortest ` +
      `"${videoOut}"`
  );

  run(`ffmpeg -y -v error -ss 2 -i "${videoOut}" -vframes 1 -q:v 2 "${thumbOut}"`);

  const meta = {
    headline,
    voice,
    format,
    durationSec,
    video: 'output/desk-brief.mp4',
    thumbnail: 'output/desk-brief-thumb.jpg',
    generated_at: new Date().toISOString(),
    script_preview: script.slice(0, 200) + '...',
  };
  fs.writeFileSync(metaOut, JSON.stringify(meta, null, 2));

  console.log('=== DONE ===');
  console.log('MP4:', videoOut, fs.existsSync(videoOut) ? fs.statSync(videoOut).size : 0, 'bytes');
  console.log('Thumb:', thumbOut);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
