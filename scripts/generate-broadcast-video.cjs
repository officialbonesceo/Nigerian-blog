/**
 * 9jaBeacon Option A: Headless Broadcast Video Generator
 * 
 * Modular Segmented Puppet Presenter, Desk with Briefing Book, Side Projection Screen,
 * Interstitial B-Roll Cutaway, Tension Music Bed & Broadcast Synthesizer
 * Formatted to match 9jaBeacon Broadcast Storyboard Specifications:
 * - 9JA BEACON LIVE watermark
 * - Stylized 2D/3D modular presenter with authentic broadcast gestures
 * - Looking at table book -> Direct audience delivery -> Pointing to side screen -> B-Roll Cutaway -> Back to book -> Sign-off
 * - Side Projection Screen with Key Takeaway Facts / Figures
 * - Lower-Third: BREAKING NEWS badge + Headline + www.9jabeacon.name.ng domain banner
 * - Intense newsroom background tension music bed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  console.log('========================================================');
  console.log('🎬 9jaBeacon Modular Puppet Broadcast Video Generator');
  console.log('========================================================');

  let presenterId = process.env.PRESENTER_ID || 'presenter_femi';
  let headline = (process.env.HEADLINE || 'Breaking News: Major National Development Reported').replace(/"/g, "'");
  let script = process.env.CUSTOM_SCRIPT || 'Good evening. This is 9jaBeacon News. We bring you verified reports on national developments and economic updates across Nigeria.';
  const hasBreakingAlert = process.env.HAS_BREAKING_ALERT === 'true' || process.env.HAS_BREAKING_ALERT === '1';
  const outputFormat = process.env.OUTPUT_FORMAT || 'landscape'; // 'landscape' (1920x1080) | 'vertical' (1080x1920)
  const articleId = process.env.ARTICLE_ID || '';

  // Auto-Select trending or most read news if requested
  let keyPoints = [
    'Major structural policy update announced with immediate effect.',
    'Federal and state stakeholders align on comprehensive implementation.',
    'Verified coverage and real-time updates on www.9jabeacon.name.ng'
  ];

  if (articleId === 'auto_trending' || articleId === 'auto_most_read' || (articleId && articleId.length > 5)) {
    console.log(`🔍 Auto-fetching article data for ID/mode: ${articleId}...`);
    try {
      const sqlitePath = path.join(process.cwd(), 'local.sqlite');
      if (fs.existsSync(sqlitePath)) {
        const sqlite3 = require('sqlite3');
        const db = new sqlite3.Database(sqlitePath);
        const query = articleId === 'auto_most_read'
          ? "SELECT id, title, summary, content, category_id, image_url FROM articles WHERE status='published' ORDER BY views_count DESC, published_at DESC LIMIT 1"
          : "SELECT id, title, summary, content, category_id, image_url FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 1";

        const articleRow = await new Promise((resolve) => {
          db.get(query, (_err, row) => resolve(row));
        });

        if (articleRow) {
          console.log(`📰 Auto-selected Article: "${articleRow.title}"`);
          headline = articleRow.title.replace(/"/g, "'");
          const cleanSummary = (articleRow.summary || articleRow.content?.slice(0, 300) || '').replace(/<[^>]+>/g, '').trim();
          script = `Good evening. Top story tonight on 9jaBeacon National News: ${headline}. ${cleanSummary}. Stay informed with verified updates as the situation develops.`;

          const sentences = cleanSummary.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
          if (sentences.length >= 2) {
            keyPoints = [
              sentences[0].slice(0, 75),
              sentences[1].slice(0, 75),
              'Full verified coverage on www.9jabeacon.name.ng'
            ];
          }

          // Auto-assign presenter by category
          const cat = articleRow.category_id || '';
          if (cat.includes('money') || cat.includes('tech') || cat.includes('business')) {
            presenterId = 'presenter_tunde';
          } else if (cat.includes('metro') || cat.includes('politics')) {
            presenterId = 'presenter_amaka';
          } else if (cat.includes('culture') || cat.includes('lifestyle') || cat.includes('sports')) {
            presenterId = 'presenter_zainab';
          } else {
            presenterId = 'presenter_femi';
          }
        }
      }
    } catch (dbErr) {
      console.log('ℹ️ Local SQLite read skipped or not available, using provided script inputs.');
    }
  }

  console.log(`👤 Presenter ID: ${presenterId}`);
  console.log(`📰 Headline: ${headline}`);
  console.log(`📐 Format: ${outputFormat}`);
  console.log(`🚨 Breaking Alert: ${hasBreakingAlert}`);
  console.log(`📝 Script Length: ${script.length} chars (${script.split(/\s+/).length} words)`);

  const outputDir = path.join(process.cwd(), 'output');
  const tempDir = path.join(process.cwd(), '.tmp_broadcast');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // Map presenter to puppet assets
  const pKey = presenterId.replace('presenter_', '');
  const puppetDir = path.join(process.cwd(), 'public', 'presenters', 'puppet');

  // Verify puppet assets exist, otherwise generate them
  if (!fs.existsSync(path.join(puppetDir, `${pKey}_pose_aud_closed.png`))) {
    console.log('⚡ Generating puppet assets first...');
    execSync('node scripts/build-puppet-assets.cjs', { stdio: 'inherit' });
  }

  const pBookClosed = path.join(puppetDir, `${pKey}_pose_book_closed.png`);
  const pBookSpeaking = path.join(puppetDir, `${pKey}_pose_book_speaking.png`);
  const pAudClosed = path.join(puppetDir, `${pKey}_pose_aud_closed.png`);
  const pAudSpeaking = path.join(puppetDir, `${pKey}_pose_aud_speaking.png`);
  const pScreenClosed = path.join(puppetDir, `${pKey}_pose_screen_closed.png`);
  const pScreenSpeaking = path.join(puppetDir, `${pKey}_pose_screen_speaking.png`);
  const pBrollCard = path.join(puppetDir, 'broll_interstitial.png');

  const presenterMetadata = {
    femi: { name: 'Femi Adeleke', gender: 'male', title: 'Senior National Affairs Anchor' },
    amaka: { name: 'Amaka Okafor', gender: 'female', title: 'Chief Primetime Anchor' },
    tunde: { name: 'Babatunde Bello', gender: 'male', title: 'Business & Tech Anchor' },
    zainab: { name: 'Zainab Aliyu', gender: 'female', title: 'Culture & Lifestyle Anchor' }
  };
  const presenter = presenterMetadata[pKey] || presenterMetadata.femi;

  // Compute speech timing & duration
  const words = script.trim().split(/\s+/).filter(Boolean);
  const wordCount = Math.max(words.length, 1);
  const wpm = 135;
  const durationSec = Math.max(Math.ceil((wordCount / wpm) * 60) + 1, 14);
  const speechEndSec = Math.max(durationSec - 1.2, 4.0);
  console.log(`⏱️ Computed broadcast duration: ${durationSec} seconds (speech ends at ~${speechEndSec}s)`);

  // Audio voiceover track
  const narrationFile = path.join(tempDir, 'narration.wav');
  let audioGenerated = false;

  try {
    const hasEspeak = execSync('which espeak || echo ""').toString().trim();
    if (hasEspeak) {
      console.log('🎙️ Generating speech via espeak...');
      const pitchArg = presenter.gender === 'female' ? '-p 65 -s 130' : '-p 40 -s 130';
      execSync(`espeak -v en-gb ${pitchArg} "${script.replace(/"/g, '')}" -w "${narrationFile}"`);
      audioGenerated = true;
    }
  } catch (e) {
    console.log('ℹ️ espeak not available, using timed broadcast tone track.');
  }

  if (!audioGenerated) {
    console.log('🎙️ Creating studio broadcast room tone envelope...');
    execSync(`ffmpeg -y -v error -f lavfi -i "anoisesrc=d=${durationSec}:c=pink:r=44100:a=0.005" -c:a pcm_s16le "${narrationFile}"`);
  }

  // Background Tension Music Bed
  const tensionBedFile = path.join(process.cwd(), 'public', 'audio', 'breaking-news-tension-bed.wav');
  const finalAudioFile = path.join(tempDir, 'final_mixed_audio.wav');

  if (fs.existsSync(tensionBedFile)) {
    console.log('🎵 Layering breaking news tension music bed under voice narration (-16dB)...');
    try {
      execSync(`ffmpeg -y -v error -i "${narrationFile}" -stream_loop -1 -i "${tensionBedFile}" -filter_complex "[0:a]volume=1.0[voice];[1:a]volume=0.14,afade=t=in:ss=0:d=1.5,afade=t=out:st=${durationSec - 2}:d=2[music];[voice][music]amix=inputs=2:duration=first:dropout_transition=2[out]" -map "[out]" -t ${durationSec} -c:a pcm_s16le "${finalAudioFile}"`);
    } catch (mixErr) {
      console.log('ℹ️ Audio mix failed, using raw narration.');
      fs.copyFileSync(narrationFile, finalAudioFile);
    }
  } else {
    fs.copyFileSync(narrationFile, finalAudioFile);
  }

  // Dimensions & Stage Layout
  const width = outputFormat === 'vertical' ? 1080 : 1920;
  const height = outputFormat === 'vertical' ? 1920 : 1080;
  const isLandscape = outputFormat !== 'vertical';

  const pSize = isLandscape ? 680 : 620;
  const presenterX = isLandscape ? '100' : '(W-w)/2';
  const presenterY = isLandscape ? '170' : '220';

  // Broadcast Storyboard Milestone Timers
  const tPrep = 1.4;
  const tAudienceEnd = tPrep + (speechEndSec - tPrep) * 0.32;
  const tScreenEnd = tPrep + (speechEndSec - tPrep) * 0.54;
  const tBrollEnd = tPrep + (speechEndSec - tPrep) * 0.74;
  const tBookEnd = tPrep + (speechEndSec - tPrep) * 0.90;

  console.log(`🎬 Gesture Timing:`);
  console.log(`  - 0.0s to ${tPrep}s: Consult Briefing Book on Desk`);
  console.log(`  - ${tPrep}s to ${tAudienceEnd.toFixed(1)}s: Look at Audience Speaking`);
  console.log(`  - ${tAudienceEnd.toFixed(1)}s to ${tScreenEnd.toFixed(1)}s: Turn to Side Screen & Point`);
  console.log(`  - ${tScreenEnd.toFixed(1)}s to ${tBrollEnd.toFixed(1)}s: B-Roll Cutaway (Field Report)`);
  console.log(`  - ${tBrollEnd.toFixed(1)}s to ${tBookEnd.toFixed(1)}s: Back to Desk Book Speaking`);
  console.log(`  - ${tBookEnd.toFixed(1)}s to ${speechEndSec.toFixed(1)}s: Look at Audience Wrap-Up`);

  // Sanitize text strings for ffmpeg drawtext filter
  const cleanFfmpegText = (str) => str.replace(/[:\\'%]/g, ' ').replace(/"/g, '').trim();
  const safeHeadline = cleanFfmpegText(headline);
  const safeP1 = cleanFfmpegText(keyPoints[0] || 'Federal policy reform announced nationwide.');
  const safeP2 = cleanFfmpegText(keyPoints[1] || 'Key economic indicators show positive momentum.');
  const safeP3 = cleanFfmpegText(keyPoints[2] || 'Full reporting live on www.9jabeacon.name.ng');
  const safePresenterName = `${presenter.name.toUpperCase()} | ${presenter.title.toUpperCase()}`;

  const outputFile = path.join(outputDir, 'broadcast-video.mp4');
  const thumbnailFile = path.join(outputDir, 'broadcast-thumbnail.jpg');
  const timelineJsonFile = path.join(outputDir, 'broadcast-timeline.json');

  // Input Indices:
  // 0: color background
  // 1: pBookClosed
  // 2: pBookSpeaking
  // 3: pAudClosed
  // 4: pAudSpeaking
  // 5: pScreenClosed
  // 6: pScreenSpeaking
  // 7: pBrollCard
  // 8: finalAudioFile

  const filterScript = [
    // 1. Studio Backdrop: Deep slate gradient + grid
    `[0:v]drawbox=x=0:y=0:w=${width}:h=${height}:color=0x064e3b@0.22:t=fill[bg_glow]`,
    `[bg_glow]drawgrid=width=90:height=90:thickness=1:color=0x1e293b@0.25[grid_bg]`,

    // 2. Scale each puppet state to pSize and split pads for multi-scene usage
    `[1:v]scale=${pSize}:${pSize},split=2[p_b_c_1][p_b_c_2]`,
    `[2:v]scale=${pSize}:${pSize}[p_b_s]`,
    `[3:v]scale=${pSize}:${pSize},split=3[p_a_c_1][p_a_c_2][p_a_c_3]`,
    `[4:v]scale=${pSize}:${pSize},split=2[p_a_s_1][p_a_s_2]`,
    `[5:v]scale=${pSize}:${pSize}[p_s_c]`,
    `[6:v]scale=${pSize}:${pSize}[p_s_s]`,

    // 3. Cadenced Puppet Animation (Switches between Closed and Speaking with phonetic lip rhythm)
    `[grid_bg][p_b_c_1]overlay=x='${presenterX}':y='${presenterY}':enable='lt(t, ${tPrep})'[st1]`,
    `[st1][p_a_c_1]overlay=x='${presenterX}':y='${presenterY}':enable='between(t, ${tPrep}, ${tAudienceEnd})*gte(mod(t*4.2, 1), 0.52)'[st2]`,
    `[st2][p_a_s_1]overlay=x='${presenterX}':y='${presenterY}':enable='between(t, ${tPrep}, ${tAudienceEnd})*lt(mod(t*4.2, 1), 0.52)'[st3]`,
    `[st3][p_s_c]overlay=x='${presenterX}':y='${presenterY}':enable='between(t, ${tAudienceEnd}, ${tScreenEnd})*gte(mod(t*4.2, 1), 0.52)'[st4]`,
    `[st4][p_s_s]overlay=x='${presenterX}':y='${presenterY}':enable='between(t, ${tAudienceEnd}, ${tScreenEnd})*lt(mod(t*4.2, 1), 0.52)'[st5]`,
    `[st5][p_b_s]overlay=x='${presenterX}':y='${presenterY}':enable='between(t, ${tBrollEnd}, ${tBookEnd})*lt(mod(t*4.2, 1), 0.52)'[st6]`,
    `[st6][p_b_c_2]overlay=x='${presenterX}':y='${presenterY}':enable='between(t, ${tBrollEnd}, ${tBookEnd})*gte(mod(t*4.2, 1), 0.52)'[st7]`,
    `[st7][p_a_c_2]overlay=x='${presenterX}':y='${presenterY}':enable='between(t, ${tBookEnd}, ${speechEndSec})*gte(mod(t*4.2, 1), 0.52)'[st8]`,
    `[st8][p_a_s_2]overlay=x='${presenterX}':y='${presenterY}':enable='between(t, ${tBookEnd}, ${speechEndSec})*lt(mod(t*4.2, 1), 0.52)'[st9]`,
    `[st9][p_a_c_3]overlay=x='${presenterX}':y='${presenterY}':enable='gte(t, ${speechEndSec})'[stage_anchor]`,

    // 4. Side Projection Screen on Right (Landscape only)
    ...(isLandscape ? [
      `[stage_anchor]drawbox=x=920:y=180:w=900:h=460:color=0x0f172a@0.90:t=fill[proj_card]`,
      `[proj_card]drawbox=x=920:y=180:w=900:h=4:color=0x10b981:t=fill[proj_border]`,
      `[proj_border]drawbox=x=950:y=210:w=320:h=38:color=0x022c22@0.9:t=fill[proj_tag]`,
      `[proj_tag]drawtext=text='THE BIG PICTURE':fontcolor=0x34d399:fontsize=18:x=965:y=220[proj_title]`,
      `[proj_title]drawtext=text='• ${safeP1}':fontcolor=white:fontsize=22:x=950:y=280[p1]`,
      `[p1]drawtext=text='• ${safeP2}':fontcolor=white:fontsize=22:x=950:y=350[p2]`,
      `[p2]drawtext=text='• ${safeP3}':fontcolor=0x94a3b8:fontsize=20:x=950:y=420[p3]`,
      `[p3]drawbox=x=950:y=540:w=840:h=40:color=0x020617@0.95:t=fill[foot_bar]`,
      `[foot_bar]drawtext=text='9jaBEACON VERIFIED CITIZEN REPORTING':fontcolor=0x10b981:fontsize=16:x=970:y=552[stage_with_card]`
    ] : [
      `[stage_anchor]null[stage_with_card]`
    ]),

    // 5. B-Roll Interstitial Cutaway Overlay (Appears during tScreenEnd -> tBrollEnd)
    `[7:v]scale=${width}:${height}[broll_scaled]`,
    `[stage_with_card][broll_scaled]overlay=x=0:y=0:enable='between(t, ${tScreenEnd}, ${tBrollEnd})'[stage_with_broll]`,

    // 6. Top-Left Watermark (Always above presenter)
    `[stage_with_broll]drawbox=x=80:y=60:w=160:h=44:color=0x0f172a@0.95:t=fill[wm_bg]`,
    `[wm_bg]drawtext=text='9JA BEACON':fontcolor=white:fontsize=20:x=95:y=72[wm_text]`,
    `[wm_text]drawbox=x=240:y=60:w=80:h=44:color=0xdc2626:t=fill[live_box]`,
    `[live_box]drawtext=text='LIVE':fontcolor=white:fontsize=20:x=258:y=72[live_text]`,

    // 7. Lower-Third News Strap:
    // Red BREAKING NEWS Badge Box
    `[live_text]drawbox=x=60:y=${height - 230}:w=240:h=44:color=0xdc2626:t=fill[break_box]`,
    `[break_box]drawtext=text='BREAKING NEWS':fontcolor=white:fontsize=20:x=85:y=${height - 218}[break_text]`,

    // Main Headline Bar
    `[break_text]drawbox=x=60:y=${height - 184}:w=${width - 120}:h=74:color=0x0f172a@0.98:t=fill[head_box]`,
    `[head_box]drawbox=x=60:y=${height - 184}:w=6:h=74:color=0x10b981:t=fill[head_accent]`,
    `[head_accent]drawtext=text='${safeHeadline}':fontcolor=white:fontsize=28:x=85:y=${height - 158}[head_text]`,

    // Domain & Slogan Underneath Headline
    `[head_text]drawbox=x=60:y=${height - 108}:w=${width - 120}:h=46:color=0x020617@0.98:t=fill[sub_box]`,
    `[sub_box]drawtext=text='Stay informed | www.9jabeacon.name.ng - Nigeria Independent Newsroom':fontcolor=0x94a3b8:fontsize=18:x=85:y=${height - 94}[sub_text]`,

    // Anchor Tag
    `[sub_text]drawtext=text='${safePresenterName}':fontcolor=0x34d399:fontsize=15:x=${width - 500}:y=${height - 94}[final_video]`
  ].join(';');

  const ffmpegCmd = [
    'ffmpeg -y',
    `-f lavfi -i "color=c=#070b14:s=${width}x${height}:d=${durationSec}"`,
    `-loop 1 -i "${pBookClosed}"`,
    `-loop 1 -i "${pBookSpeaking}"`,
    `-loop 1 -i "${pAudClosed}"`,
    `-loop 1 -i "${pAudSpeaking}"`,
    `-loop 1 -i "${pScreenClosed}"`,
    `-loop 1 -i "${pScreenSpeaking}"`,
    `-loop 1 -i "${pBrollCard}"`,
    `-i "${finalAudioFile}"`,
    `-filter_complex "${filterScript}"`,
    '-map "[final_video]"',
    '-map 8:a',
    `-t ${durationSec}`,
    '-c:v libx264 -pix_fmt yuv420p -preset fast -crf 22',
    '-c:a aac -b:a 192k',
    `"${outputFile}"`
  ].join(' ');

  console.log('⚙️ Executing ffmpeg modular broadcast puppet render pipeline...');
  execSync(ffmpegCmd);

  // Generate thumbnail
  console.log('📸 Generating broadcast thumbnail...');
  execSync(`ffmpeg -y -v error -ss 00:00:03 -i "${outputFile}" -vframes 1 -q:v 2 "${thumbnailFile}"`);

  // Write scene plan json
  const planData = {
    presenter_id: presenterId,
    presenter_name: presenter.name,
    headline: headline,
    key_points: keyPoints,
    gestures: [
      { time_sec: 0, gaze: 'book', arms: 'hold_notes', action: 'consulting_briefing_book' },
      { time_sec: tPrep, gaze: 'audience', arms: 'desk_rest', action: 'headline_delivery' },
      { time_sec: tAudienceEnd, gaze: 'screen', arms: 'gesture_screen', action: 'referencing_side_projection' },
      { time_sec: tScreenEnd, stage: 'b_roll', action: 'field_footage_interstitial' },
      { time_sec: tBrollEnd, gaze: 'book', arms: 'hold_notes', action: 'reading_table_book_speaking' },
      { time_sec: tBookEnd, gaze: 'audience', arms: 'desk_rest', action: 'wrap_signoff' }
    ],
    video_path: outputFile,
    thumbnail_path: thumbnailFile,
    generated_at: new Date().toISOString()
  };

  fs.writeFileSync(timelineJsonFile, JSON.stringify(planData, null, 2));

  console.log('========================================================');
  console.log('🎉 Broadcast Video Generation Completed Flawlessly!');
  console.log(`📹 Video Output: ${outputFile}`);
  console.log(`🖼️ Thumbnail: ${thumbnailFile}`);
  console.log(`📄 Timeline Plan: ${timelineJsonFile}`);
  console.log('========================================================');
}

main().catch((err) => {
  console.error('❌ Broadcast Video Generation Failed:', err);
  process.exit(1);
});
