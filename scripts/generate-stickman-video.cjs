/**
 * 9jaBeacon Stickman Motivational Video Motion Engine
 * Generates viral 9:16 vertical TikTok/Reels/Shorts videos (1080x1920)
 * featuring the glowing golden stickman on the cliff of Discipline reaching God's Plan.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  console.log('========================================================');
  console.log('🎬 9jaBeacon Stickman Motivational Video Motion Engine');
  console.log('========================================================');

  const theme = process.env.THEME || 'discipline_gods_plan';
  let script = process.env.CUSTOM_SCRIPT || '';

  // Default thematic scripts
  const themes = {
    discipline_gods_plan: {
      headline: "DISCIPLINE IS THE BRIDGE",
      script: "When you choose discipline over temporary comfort, every sacrifice you make today is building the bridge to God's plan. Keep going. Your victory is waiting.",
      caption1: "DISCIPLINE IS THE SACRIFICE",
      caption2: "GOD'S PLAN IS THE REWARD"
    },
    consistency_wealth: {
      headline: "CONSISTENCY OVER TALENT",
      script: "Talent may open doors, but consistency carries you through the fire. When everyone else gives up, the disciplined soul keeps walking toward abundance.",
      caption1: "NEVER STOP WALKING",
      caption2: "YOUR BREAKTHROUGH IS NEAR"
    },
    faith_perseverance: {
      headline: "FAITH ACROSS THE CHASM",
      script: "The distance between who you are and where God is taking you requires faith. Take the first step across the darkness. The gold is on the other side.",
      caption1: "TRUST THE PROCESS",
      caption2: "VICTORY BELONGS TO THE BRAVE"
    }
  };

  const selectedTheme = themes[theme] || themes.discipline_gods_plan;
  if (!script) {
    script = selectedTheme.script;
  }

  console.log(`📌 Theme: ${theme}`);
  console.log(`📝 Script: "${script}"`);

  const outputDir = path.join(process.cwd(), 'output');
  const tempDir = path.join(process.cwd(), '.tmp_stickman');
  const assetsDir = path.join(process.cwd(), 'public', 'stickman');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Verify stickman assets exist
  const bgImage = path.join(assetsDir, 'background_cliff_gold.png');
  const pStanding = path.join(assetsDir, 'stickman_standing.png');
  const pWalking = path.join(assetsDir, 'stickman_walking.png');
  const pLeaping = path.join(assetsDir, 'stickman_leaping.png');
  const pVictory = path.join(assetsDir, 'stickman_victory.png');

  if (!fs.existsSync(bgImage) || !fs.existsSync(pVictory)) {
    console.log('⚡ Generating stickman visual assets first...');
    execSync('node scripts/build-stickman-assets.cjs', { stdio: 'inherit' });
  }

  // Calculate timing & audio length
  const words = script.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wpm = 120; // Deep, slow, stoic motivational pacing
  const durationSec = Math.max(Math.ceil((wordCount / wpm) * 60) + 2, 12);
  console.log(`⏱️ Computed video duration: ${durationSec} seconds (${wordCount} words)`);

  // Audio generation
  const narrationFile = path.join(tempDir, 'narration.wav');
  const finalAudioFile = path.join(tempDir, 'final_mixed_audio.wav');
  let audioGenerated = false;

  try {
    const hasEspeak = execSync('which espeak || echo ""').toString().trim();
    if (hasEspeak) {
      console.log('🎙️ Generating deep motivational narration via espeak (-p 32 -s 125)...');
      // Low pitch (-p 32) + measured speed (-s 125) produces deep stoic voice
      execSync(`espeak -v en-us -p 32 -s 125 "${script.replace(/"/g, '')}" -w "${narrationFile}"`);
      audioGenerated = true;
    }
  } catch {}

  if (!audioGenerated) {
    console.log('🎙️ Generating ambient audio tone...');
    execSync(`ffmpeg -y -v error -f lavfi -i "anoisesrc=d=${durationSec}:c=pink:r=44100:a=0.005" -c:a pcm_s16le "${narrationFile}"`);
  }

  // Mix with cinematic tension music bed
  const tensionBedFile = path.join(process.cwd(), 'public', 'audio', 'breaking-news-tension-bed.wav');
  if (fs.existsSync(tensionBedFile)) {
    console.log('🎵 Layering dark ambient cinematic bed under voiceover (-18dB)...');
    try {
      execSync(`ffmpeg -y -v error -i "${narrationFile}" -stream_loop -1 -i "${tensionBedFile}" -filter_complex "[0:a]volume=1.2,aecho=0.8:0.7:40:0.3[voice];[1:a]volume=0.12,afade=t=in:ss=0:d=1.5,afade=t=out:st=${durationSec - 2}:d=2[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[out]" -map "[out]" -t ${durationSec} -c:a pcm_s16le "${finalAudioFile}"`);
    } catch {
      fs.copyFileSync(narrationFile, finalAudioFile);
    }
  } else {
    fs.copyFileSync(narrationFile, finalAudioFile);
  }

  // Visual Scene Timings
  const t1 = (durationSec * 0.25).toFixed(2); // Scene 1 -> 2
  const t2 = (durationSec * 0.55).toFixed(2); // Scene 2 -> 3
  const t3 = (durationSec * 0.75).toFixed(2); // Scene 3 -> 4 (Victory on Gold)

  const outputFile = path.join(outputDir, 'stickman-motivational-video.mp4');
  const thumbnailFile = path.join(outputDir, 'stickman-thumbnail.jpg');

  console.log(`🎬 Rendering 1080x1920 60FPS vertical video to: ${outputFile}...`);

  const sSize = 420; // Stickman dimension scale
  const cap1 = (selectedTheme.caption1 || 'DISCIPLINE TODAY').replace(/'/g, '’');
  const cap2 = (selectedTheme.caption2 || "GOD’S PLAN TOMORROW").replace(/'/g, '’');

  const filterScript = [
    // 1. Base Environment (1080x1920)
    `[0:v]scale=1080:1920[bg]`,

    // 2. Scale stickman poses
    `[1:v]scale=${sSize}:${sSize}[p_stand]`,
    `[2:v]scale=${sSize}:${sSize}[p_walk]`,
    `[3:v]scale=${sSize}:${sSize}[p_leap]`,
    `[4:v]scale=${sSize + 60}:${sSize + 60}[p_vic]`,

    // 3. Stickman Progression Across Cliff & Chasm:
    // Scene 1 (0 -> t1): Standing on left cliff (x=160, y=780)
    `[bg][p_stand]overlay=x=160:y=780:enable='lt(t, ${t1})'[st1]`,

    // Scene 2 (t1 -> t2): Walking towards the edge with forward stride (moving from x=160 to x=320)
    `[st1][p_walk]overlay=x='160+160*(t-${t1})/(${t2}-${t1})':y=770:enable='between(t, ${t1}, ${t2})'[st2]`,

    // Scene 3 (t2 -> t3): Leaping across the chasm stepping bridge (x=380 -> 540)
    `[st2][p_leap]overlay=x='360+200*(t-${t2})/(${t3}-${t2})':y=760:enable='between(t, ${t2}, ${t3})'[st3]`,

    // Scene 4 (t3 -> end): Victory pose standing triumphantly on top of the gold mountain (x=590, y=700)
    `[st3][p_vic]overlay=x=590:y=700:enable='gte(t, ${t3})'[stage]`,

    // 4. Subtle pulsating gold glow aura around victory pose during climax
    `[stage]drawbox=x=700:y=800:w=260:h=6:color=0xfde047@0.6:t=fill:enable='gte(t, ${t3})'[stage_glow]`,

    // 5. Dynamic Centered Motivational Kinetic Subtitles (Lower-Third)
    `[stage_glow]drawbox=x=80:y=1540:w=920:h=180:color=0x000000@0.82:t=fill[sub_card]`,
    `[sub_card]drawbox=x=80:y=1540:w=920:h=4:color=0xeab308:t=fill[sub_border]`,
    `[sub_border]drawtext=text='${cap1}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=1580[sub1]`,
    `[sub1]drawtext=text='${cap2}':fontcolor=0xfde047:fontsize=50:x=(w-text_w)/2:y=1642[final_video]`
  ].join(';');

  const ffmpegCmd = [
    'ffmpeg -y',
    `-loop 1 -i "${bgImage}"`,
    `-loop 1 -i "${pStanding}"`,
    `-loop 1 -i "${pWalking}"`,
    `-loop 1 -i "${pLeaping}"`,
    `-loop 1 -i "${pVictory}"`,
    `-i "${finalAudioFile}"`,
    `-filter_complex "${filterScript}"`,
    `-map "[final_video]"`,
    `-map 5:a`,
    `-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p`,
    `-c:a aac -b:a 192k`,
    `-t ${durationSec}`,
    `"${outputFile}"`
  ].join(' ');

  execSync(ffmpegCmd, { stdio: 'inherit' });
  console.log(`✅ Stickman video rendered successfully: ${outputFile}`);

  // Generate thumbnail snapshot at climax (Scene 4: Victory on gold)
  const thumbTime = Math.min(durationSec - 2, Number(t3) + 1);
  execSync(`ffmpeg -y -v error -ss ${thumbTime} -i "${outputFile}" -vframes 1 -q:v 2 "${thumbnailFile}"`);
  console.log(`📸 Thumbnail saved: ${thumbnailFile}`);

  console.log('========================================================');
  console.log('🎉 9jaBeacon Stickman Video Generation Complete!');
  console.log('========================================================\n');
}

main().catch(err => {
  console.error('Fatal error in stickman video generator:', err);
  process.exit(1);
});
