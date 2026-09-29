/**
 * 9jaBeacon Option A: Headless Broadcast Video Generator
 * 
 * Deterministic Presenter Animation & Video Synthesizer for GitHub Actions Workflows.
 * Reads presenter sprite sheets, creates pose-synced animation frames, renders broadcast
 * lower-thirds/tickers, and outputs broadcast-quality MP4.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  console.log('========================================================');
  console.log('🎬 9jaBeacon AI Broadcast Video Generator (Option A)');
  console.log('========================================================');

  const presenterId = process.env.PRESENTER_ID || 'presenter_femi';
  const headline = (process.env.HEADLINE || 'Breaking News: Major National Development Reported').replace(/"/g, "'");
  const script = process.env.CUSTOM_SCRIPT || 'Good evening. This is 9jaBeacon News. We bring you verified reports on national developments and economic updates across Nigeria.';
  const hasBreakingAlert = process.env.HAS_BREAKING_ALERT === 'true' || process.env.HAS_BREAKING_ALERT === '1';
  const outputFormat = process.env.OUTPUT_FORMAT || 'landscape'; // 'landscape' (1920x1080) | 'vertical' (1080x1920)

  console.log(`👤 Presenter ID: ${presenterId}`);
  console.log(`📰 Headline: ${headline}`);
  console.log(`📐 Format: ${outputFormat}`);
  console.log(`🚨 Breaking Alert: ${hasBreakingAlert}`);
  console.log(`📝 Script Length: ${script.length} chars (${script.split(/\s+/).length} words)`);

  const outputDir = path.join(process.cwd(), 'output');
  const tempDir = path.join(process.cwd(), '.tmp_broadcast');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // 1. Locate presenter sprite
  const presenterMap = {
    presenter_femi: { name: 'Femi Adeleke', file: 'femi.jpg', gender: 'male', title: 'Senior National Affairs Anchor' },
    presenter_amaka: { name: 'Amaka Okafor', file: 'amaka.jpg', gender: 'female', title: 'Chief Primetime Anchor' },
    presenter_tunde: { name: 'Babatunde Bello', file: 'tunde.jpg', gender: 'male', title: 'Business & Tech Anchor' },
    presenter_zainab: { name: 'Zainab Aliyu', file: 'zainab.jpg', gender: 'female', title: 'Culture & Lifestyle Anchor' }
  };

  const presenter = presenterMap[presenterId] || presenterMap['presenter_femi'];
  let spritePath = path.join(process.cwd(), 'public', 'presenters', presenter.file);

  if (!fs.existsSync(spritePath)) {
    // Check fallback
    const files = fs.readdirSync(path.join(process.cwd(), 'public', 'presenters'));
    if (files.length > 0) {
      spritePath = path.join(process.cwd(), 'public', 'presenters', files[0]);
    } else {
      throw new Error(`Presenter sprite not found at ${spritePath}`);
    }
  }

  console.log(`🖼️ Using Sprite Sheet: ${spritePath}`);

  // 2. Crop 4 poses (each 512x512) from the 1024x1024 sheet
  const idlePose = path.join(tempDir, 'pose_idle.jpg');
  const speakingPose = path.join(tempDir, 'pose_speaking.jpg');
  const breakingPose = path.join(tempDir, 'pose_breaking.jpg');
  const wrapPose = path.join(tempDir, 'pose_wrap.jpg');

  console.log('✂️ Extracting 2x2 sprite quadrants...');
  execSync(`ffmpeg -y -v error -i "${spritePath}" -filter_complex "[0:v]crop=512:512:0:0[idle];[0:v]crop=512:512:512:0[speaking];[0:v]crop=512:512:0:512[breaking];[0:v]crop=512:512:512:512[wrap]" -map "[idle]" "${idlePose}" -map "[speaking]" "${speakingPose}" -map "[breaking]" "${breakingPose}" -map "[wrap]" "${wrapPose}"`);

  // 3. Compute speech timing & duration
  const words = script.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(words.length, 1);
  const wpm = 135; // news anchor cadence
  const durationSec = Math.max(Math.ceil((wordCount / wpm) * 60) + 1, 4);
  console.log(`⏱️ Computed broadcast duration: ${durationSec} seconds`);

  // 4. Generate audio track
  const audioFile = path.join(tempDir, 'narration.wav');
  let audioGenerated = false;

  // Try espeak if available on system
  try {
    const hasEspeak = execSync('which espeak || echo ""').toString().trim();
    if (hasEspeak) {
      console.log('🎙️ Generating speech via espeak...');
      const pitchArg = presenter.gender === 'female' ? '-p 65 -s 130' : '-p 40 -s 130';
      execSync(`espeak -v en-gb ${pitchArg} "${script.replace(/"/g, '')}" -w "${audioFile}"`);
      audioGenerated = true;
    }
  } catch (e) {
    console.log('ℹ️ espeak not available or failed, using timed broadcast tone track.');
  }

  if (!audioGenerated) {
    // Generate clean studio ambiance / tone track matching exact duration
    console.log('🎙️ Creating studio broadcast audio envelope with room tone...');
    execSync(`ffmpeg -y -v error -f lavfi -i "anoisesrc=d=${durationSec}:c=pink:r=44100:a=0.005" -c:a pcm_s16le "${audioFile}"`);
  }

  // 5. Build Option A Lip-Sync and Pose timeline video stream
  // We alternate speaking/idle poses every ~0.24s during speech, with breaking alert in middle if requested
  const width = outputFormat === 'vertical' ? 1080 : 1920;
  const height = outputFormat === 'vertical' ? 1920 : 1080;
  const presenterScale = outputFormat === 'vertical' ? '680:680' : '640:640';
  const presenterX = outputFormat === 'vertical' ? '(W-w)/2' : 'W*0.62';
  const presenterY = outputFormat === 'vertical' ? 'H*0.22' : '(H-h)/2 + 20';

  console.log(`🎥 Rendering ${outputFormat} (${width}x${height}) broadcast video...`);

  // Create sanitized headline text for ffmpeg drawtext
  const safeHeadline = headline.replace(/[:\\']/g, ' ');
  const safePresenterName = `${presenter.name.toUpperCase()} | 9jaBEACON`;
  const categoryColor = hasBreakingAlert ? 'red@0.9' : '0x008751@0.95';

  const outputFile = path.join(outputDir, 'broadcast-video.mp4');
  const thumbnailFile = path.join(outputDir, 'broadcast-thumbnail.jpg');
  const timelineJsonFile = path.join(outputDir, 'broadcast-timeline.json');

  // ffmpeg filter complex for broadcast studio composition:
  // - Background: Deep slate radial studio gradient
  // - Presenter: Alternates between idle and speaking every 0.25s (lip sync flapping)
  // - Studio Desk & Lower Third overlay
  // - News Bar with Headline & Live ticker
  const filterScript = [
    // 0: background generator
    `color=c=#090d16:s=${width}x${height}:d=${durationSec}[bg]`,
    // Studio ambient lighting circle
    `[bg]drawbox=x=0:y=0:w=${width}:h=${height}:color=0x022c22@0.2:t=fill[bg_lit]`,
    // Studio digital grid lines
    `[bg_lit]drawgrid=width=80:height=80:thickness=1:color=0x1e293b@0.25[grid_bg]`,
    // Scale presenter poses
    `[1:v]scale=${presenterScale}[idle_scaled]`,
    `[2:v]scale=${presenterScale}[speaking_scaled]`,
    // Alternating lip flap expression: switch every 0.22 seconds
    `[idle_scaled][speaking_scaled]blend=all_expr='if(lt(mod(T*4.5,2),1),A,B)'[presenter_anim]`,
    // Overlay presenter on studio background
    `[grid_bg][presenter_anim]overlay=x='${presenterX}':y='${presenterY}':shortest=1[studio_stage]`,
    // Top-left station logo banner
    `[studio_stage]drawbox=x=40:y=40:w=260:h=46:color=0x008751@0.95:t=fill[logo_bg]`,
    `[logo_bg]drawtext=text='9jaBEACON NEWS':fontcolor=white:fontsize=22:x=60:y=52[logo_text]`,
    // Status badge (LIVE / BREAKING)
    `[logo_text]drawbox=x=310:y=40:w=120:h=46:color=${categoryColor}:t=fill[live_bg]`,
    `[live_bg]drawtext=text='${hasBreakingAlert ? 'BREAKING' : 'LIVE'}':fontcolor=white:fontsize=20:x=332:y=54[live_text]`,
    // Lower-third news strap background
    `[live_text]drawbox=x=40:y=${height - 180}:w=${width - 80}:h=110:color=0x0f172a@0.95:t=fill[lower_bg]`,
    // Lower-third gold accent line
    `[lower_bg]drawbox=x=40:y=${height - 180}:w=${width - 80}:h=4:color=0x10b981:t=fill[lower_line]`,
    // Presenter name badge
    `[lower_line]drawtext=text='${safePresenterName}':fontcolor=0x34d399:fontsize=18:x=60:y=${height - 165}[name_tag]`,
    // Main headline text
    `[name_tag]drawtext=text='${safeHeadline}':fontcolor=white:fontsize=28:x=60:y=${height - 130}[headline_tag]`,
    // Scrolling bottom ticker bar
    `[headline_tag]drawbox=x=40:y=${height - 60}:w=${width - 80}:h=40:color=0x020617@0.98:t=fill[ticker_bg]`,
    `[ticker_bg]drawtext=text='9jaBEACON &bull; VERIFIED NIGERIAN NEWS &bull; POLITICS &bull; BUSINESS &bull; TECHNOLOGY &bull; METRO &bull; REAL-TIME REPORTING':fontcolor=0x94a3b8:fontsize=16:x='w-mod(t*120\\,w+1200)':y=${height - 48}[final_video]`
  ].join(';');

  const ffmpegCmd = [
    'ffmpeg -y',
    `-f lavfi -i "color=c=#090d16:s=${width}x${height}:d=${durationSec}"`,
    `-loop 1 -i "${idlePose}"`,
    `-loop 1 -i "${speakingPose}"`,
    `-i "${audioFile}"`,
    `-filter_complex "${filterScript}"`,
    '-map "[final_video]"',
    '-map 3:a',
    `-t ${durationSec}`,
    '-c:v libx264 -pix_fmt yuv420p -preset fast -crf 22',
    '-c:a aac -b:a 128k',
    `"${outputFile}"`
  ].join(' ');

  console.log('⚙️ Executing ffmpeg video render pipeline...');
  execSync(ffmpegCmd);

  // 6. Generate crisp thumbnail
  console.log('📸 Generating broadcast thumbnail...');
  execSync(`ffmpeg -y -v error -ss 00:00:02 -i "${outputFile}" -vframes 1 -q:v 2 "${thumbnailFile}"`);

  // 7. Write timeline JSON metadata
  const timelineMetadata = {
    presenterId,
    presenterName: presenter.name,
    headline,
    durationSec,
    outputFormat,
    resolution: `${width}x${height}`,
    hasBreakingAlert,
    generatedAt: new Date().toISOString(),
    files: {
      video: 'output/broadcast-video.mp4',
      thumbnail: 'output/broadcast-thumbnail.jpg'
    }
  };
  fs.writeFileSync(timelineJsonFile, JSON.stringify(timelineMetadata, null, 2));

  console.log('✅ Broadcast generation complete!');
  console.log(`📁 Video: ${outputFile} (${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`📁 Thumbnail: ${thumbnailFile}`);
  console.log(`📁 Metadata: ${timelineJsonFile}`);
  console.log('========================================================');
}

main().catch((err) => {
  console.error('❌ Broadcast Video Generation Failed:', err.message);
  process.exit(1);
});
