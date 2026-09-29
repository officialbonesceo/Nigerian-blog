/**
 * 9jaBeacon Broadcast Audio & Tension Music Generator
 * Synthesizes news tension beds, intro stingers, and ambient newsroom audio using ffmpeg lavfi.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const audioDir = path.join(process.cwd(), 'public', 'audio');
if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });

console.log('🎵 Synthesizing 9jaBeacon broadcast news audio beds...');

// 1. Breaking News Tension Bed (60s loopable tension drone with pulsing sub-bass & ticker cadence)
const tensionFile = path.join(audioDir, 'breaking-news-tension-bed.wav');
try {
  const tensionCmd = [
    'ffmpeg -y -v error',
    '-f lavfi -i "sine=frequency=55:duration=60"',
    '-f lavfi -i "sine=frequency=110:duration=60"',
    '-f lavfi -i "sine=frequency=165:duration=60"',
    '-f lavfi -i "anoisesrc=d=60:c=pink:r=44100:a=0.03"',
    '-filter_complex "[0:a]tremolo=f=1.2:d=0.7,volume=0.5[sub];[1:a]volume=0.25[drone1];[2:a]volume=0.18[drone2];[3:a]highpass=f=2000,lowpass=f=6000,tremolo=f=4.0:d=0.9,volume=0.15[ticker];[sub][drone1][drone2][ticker]amix=inputs=4:duration=first:dropout_transition=2,volume=1.4,afade=t=in:ss=0:d=1,afade=t=out:st=58:d=2[out]"',
    '-map "[out]"',
    '-c:a pcm_s16le',
    `"${tensionFile}"`
  ].join(' ');

  execSync(tensionCmd);
  console.log(`✅ Created: ${tensionFile} (${(fs.statSync(tensionFile).size / 1024).toFixed(1)} KB)`);
} catch (e) {
  console.error('Error generating tension bed:', e.message);
}

// 2. Intro News Stinger / Fanfare (4-second impact boom + rising chord)
const stingerFile = path.join(audioDir, 'news-intro-stinger.wav');
try {
  const stingerCmd = [
    'ffmpeg -y -v error',
    '-f lavfi -i "sine=frequency=110:duration=4"',
    '-f lavfi -i "sine=frequency=440:duration=4"',
    '-f lavfi -i "sine=frequency=659.25:duration=4"',
    '-f lavfi -i "sine=frequency=880:duration=4"',
    '-filter_complex "[0:a]afade=t=in:ss=0:d=0.05,afade=t=out:st=1.5:d=2.5,volume=0.6[bass];[1:a]afade=t=in:ss=0:d=0.1,afade=t=out:st=1:d=3,volume=0.3[chime1];[2:a]afade=t=in:ss=0.2:d=0.1,afade=t=out:st=1.2:d=2.8,volume=0.25[chime2];[3:a]afade=t=in:ss=0.4:d=0.1,afade=t=out:st=1.4:d=2.6,volume=0.2[chime3];[bass][chime1][chime2][chime3]amix=inputs=4:duration=first,volume=1.6[out]"',
    '-map "[out]"',
    '-c:a pcm_s16le',
    `"${stingerFile}"`
  ].join(' ');

  execSync(stingerCmd);
  console.log(`✅ Created: ${stingerFile} (${(fs.statSync(stingerFile).size / 1024).toFixed(1)} KB)`);
} catch (e) {
  console.error('Error generating stinger:', e.message);
}

// 3. Ambient Corporate News Bed (Steady newsroom background)
const bulletinFile = path.join(audioDir, 'news-bulletin-bed.wav');
try {
  const bulletinCmd = [
    'ffmpeg -y -v error',
    '-f lavfi -i "sine=frequency=130.81:duration=60"',
    '-f lavfi -i "sine=frequency=196:duration=60"',
    '-f lavfi -i "anoisesrc=d=60:c=pink:r=44100:a=0.015"',
    '-filter_complex "[0:a]volume=0.2[pad1];[1:a]volume=0.15[pad2];[2:a]highpass=f=1500,volume=0.08[room];[pad1][pad2][room]amix=inputs=3:duration=first,afade=t=in:ss=0:d=1.5,afade=t=out:st=58:d=2[out]"',
    '-map "[out]"',
    '-c:a pcm_s16le',
    `"${bulletinFile}"`
  ].join(' ');

  execSync(bulletinCmd);
  console.log(`✅ Created: ${bulletinFile} (${(fs.statSync(bulletinFile).size / 1024).toFixed(1)} KB)`);
} catch (e) {
  console.error('Error generating bulletin bed:', e.message);
}

console.log('🎉 Broadcast audio generation complete!');
