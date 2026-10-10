/**
 * 9jaBeacon Stickman Motivational Video Asset Synthesizer
 * Generates vector-pristine SVG & PNG assets for viral 9:16 vertical stickman motivational videos.
 * Matches the golden stickman, cliff, chasm, and gold mountain aesthetic from TikTok / Reels.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outputDir = path.join(process.cwd(), 'public', 'stickman');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// 1. Generate 1080x1920 Background Environment
function generateBackgroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#020617"/>
        <stop offset="40%" stop-color="#09090b"/>
        <stop offset="85%" stop-color="#050505"/>
        <stop offset="100%" stop-color="#000000"/>
      </linearGradient>

      <!-- Golden Radiant Nebula in upper center -->
      <radialGradient id="goldAura" cx="48%" cy="42%" r="45%">
        <stop offset="0%" stop-color="#ca8a04" stop-opacity="0.22"/>
        <stop offset="50%" stop-color="#eab308" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>

      <!-- Glow filter for neon golden texts and borders -->
      <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <!-- Treasure Pile Gold Gradient -->
      <radialGradient id="goldPile" cx="50%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#fef08a"/>
        <stop offset="35%" stop-color="#facc15"/>
        <stop offset="70%" stop-color="#ca8a04"/>
        <stop offset="100%" stop-color="#713f12"/>
      </radialGradient>
    </defs>

    <!-- Deep Space Background -->
    <rect width="1080" height="1920" fill="url(#skyGrad)"/>
    <rect width="1080" height="1920" fill="url(#goldAura)"/>

    <!-- Subtle atmospheric dust particles -->
    <g opacity="0.45">
      <circle cx="210" cy="480" r="2.5" fill="#fde047"/>
      <circle cx="340" cy="320" r="3" fill="#facc15"/>
      <circle cx="520" cy="590" r="2" fill="#ffffff"/>
      <circle cx="780" cy="420" r="3.5" fill="#fef08a"/>
      <circle cx="890" cy="740" r="2" fill="#eab308"/>
      <circle cx="150" cy="850" r="3" fill="#facc15"/>
      <circle cx="670" cy="880" r="2.5" fill="#fde047"/>
      <circle cx="430" cy="1050" r="2" fill="#ffffff"/>
      <circle cx="820" cy="1150" r="3" fill="#facc15"/>
    </g>

    <!-- Left Cliff (Dark jagged rock silhouette where the stickman starts) -->
    <path d="M 0,1180 L 460,1130 L 480,1150 L 420,1280 L 490,1380 L 430,1540 L 520,1690 L 480,1920 L 0,1920 Z" fill="#18181b"/>
    <path d="M 0,1180 L 460,1130 L 480,1150" stroke="#3f3f46" stroke-width="3" fill="none"/>

    <!-- Left Cliff Label: DISCIPLINE -->
    <g transform="translate(240, 1340)">
      <text x="0" y="0" font-family="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#71717a" letter-spacing="4" text-anchor="middle" opacity="0.8">DISCIPLINE</text>
    </g>

    <!-- Right Ascending Mountain Slope / Gold Treasure Field -->
    <path d="M 680,1920 L 680,1250 Q 820,1100 1080,720 L 1080,1920 Z" fill="#1c1917"/>

    <!-- Massive Pile of Golden Nuggets & Treasure (Right Cliff Elevation) -->
    <g id="treasurePile" filter="url(#goldGlow)">
      <!-- Main golden heap polygon -->
      <polygon points="690,1260 760,1180 840,1110 930,950 1010,820 1080,730 1080,1550 680,1550" fill="url(#goldPile)"/>
      <!-- Shimmering facets on gold pile -->
      <polygon points="760,1180 810,1140 840,1210 770,1240" fill="#fef08a" opacity="0.65"/>
      <polygon points="840,1110 890,1030 940,1090 870,1160" fill="#ffffff" opacity="0.45"/>
      <polygon points="930,950 990,870 1040,940 960,1010" fill="#fef08a" opacity="0.75"/>
      <polygon points="1010,820 1050,760 1080,780 1060,860" fill="#ffffff" opacity="0.8"/>
      <!-- Scattered gold nuggets tumbling down the slope -->
      <circle cx="670" cy="1280" r="14" fill="#facc15"/>
      <circle cx="695" cy="1320" r="18" fill="#eab308"/>
      <circle cx="720" cy="1350" r="15" fill="#fde047"/>
      <circle cx="650" cy="1330" r="12" fill="#ca8a04"/>
      <circle cx="680" cy="1370" r="16" fill="#facc15"/>
      <circle cx="630" cy="1360" r="11" fill="#eab308"/>
      <circle cx="660" cy="1410" r="17" fill="#fef08a"/>
    </g>

    <!-- Right Mountain Label: God's Plan with Radiant Glow -->
    <g transform="translate(860, 1140)" filter="url(#goldGlow)">
      <text x="0" y="0" font-family="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="40" font-weight="900" fill="#fde047" letter-spacing="1" text-anchor="middle">God's Plan</text>
    </g>

    <!-- Glowing Bridge / Stepping Stone Across Chasm -->
    <g id="chasmBridge" opacity="0.85">
      <ellipse cx="570" cy="1165" rx="55" ry="12" fill="#27272a" stroke="#ca8a04" stroke-width="2"/>
      <ellipse cx="570" cy="1165" rx="35" ry="6" fill="#facc15" opacity="0.3" filter="url(#goldGlow)"/>
    </g>

    <!-- Top Branding Watermark -->
    <g transform="translate(540, 140)">
      <text x="0" y="0" font-family="-apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" letter-spacing="6" text-anchor="middle" opacity="0.7">👑 DISCIPLINE 👑</text>
    </g>
  </svg>`;
}

// 2. Generate Glowing Golden Stickman Character Poses (500x500 Transparent SVGs)
function generateStickmanSvg(pose) {
  let content = '';

  switch (pose) {
    case 'standing':
      // Standing on cliff edge looking forward across chasm (thoughtful)
      content = `
        <!-- Head -->
        <circle cx="250" cy="130" r="38" fill="#ffffff"/>
        <!-- Torso -->
        <line x1="250" y1="168" x2="250" y2="310" stroke="#fef08a" stroke-width="15" stroke-linecap="round"/>
        <!-- Left Arm (Hand on hip) -->
        <polyline points="250,205 185,250 215,295" stroke="#fef08a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Right Arm (Pointing across gap) -->
        <polyline points="250,205 315,225 385,200" stroke="#fef08a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Left Leg -->
        <polyline points="250,310 215,395 210,480" stroke="#fef08a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Right Leg -->
        <polyline points="250,310 280,395 295,480" stroke="#fef08a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      `;
      break;

    case 'walking':
      // Walking with strong forward lean and purposeful strides
      content = `
        <!-- Head -->
        <circle cx="280" cy="130" r="38" fill="#ffffff"/>
        <!-- Torso -->
        <line x1="280" y1="168" x2="250" y2="310" stroke="#fef08a" stroke-width="15" stroke-linecap="round"/>
        <!-- Left Arm (Swinging backward) -->
        <polyline points="270,210 205,255 160,295" stroke="#fef08a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Right Arm (Pumping forward) -->
        <polyline points="270,210 330,230 380,260" stroke="#fef08a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Left Leg (Trailing back) -->
        <polyline points="250,310 190,380 150,470" stroke="#fef08a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Right Leg (Stepping forward) -->
        <polyline points="250,310 320,385 365,475" stroke="#fef08a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      `;
      break;

    case 'leaping':
      // Mid-stride / stepping over the chasm bridge
      content = `
        <!-- Head -->
        <circle cx="270" cy="115" r="38" fill="#ffffff"/>
        <!-- Torso -->
        <line x1="270" y1="153" x2="250" y2="295" stroke="#fef08a" stroke-width="15" stroke-linecap="round"/>
        <!-- Left Arm (Balance back) -->
        <polyline points="265,195 190,205 130,225" stroke="#fef08a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Right Arm (Reach forward) -->
        <polyline points="265,195 340,180 410,165" stroke="#fef08a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Left Leg (Pushed back) -->
        <polyline points="250,295 180,350 120,410" stroke="#fef08a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Right Leg (Stretching forward to land) -->
        <polyline points="250,295 320,360 385,450" stroke="#fef08a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      `;
      break;

    case 'victory':
    default:
      // Both hands raised in triumph / praise on top of gold (matching screenshot!)
      content = `
        <!-- Head with radiant glow -->
        <circle cx="250" cy="130" r="40" fill="#ffffff"/>
        <!-- Torso -->
        <line x1="250" y1="170" x2="250" y2="310" stroke="#fef08a" stroke-width="16" stroke-linecap="round"/>
        <!-- Left Arm (Raised up in victory \\ ) -->
        <polyline points="250,200 180,140 140,80" stroke="#fef08a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Right Arm (Raised up in victory / ) -->
        <polyline points="250,200 320,140 360,80" stroke="#fef08a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Left Leg -->
        <polyline points="250,310 200,390 190,480" stroke="#fef08a" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <!-- Right Leg -->
        <polyline points="250,310 295,385 325,480" stroke="#fef08a" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      `;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
    <defs>
      <!-- Intense multi-stage glowing neon halo filter -->
      <filter id="intenseGoldBloom" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blurWide"/>
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blurMid"/>
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blurSharp"/>
        <feColorMatrix in="blurWide" type="matrix" values="
          1 0 0 0 0.98
          0 1 0 0 0.85
          0 0 1 0 0.20
          0 0 0 1.2 0" result="goldWide"/>
        <feColorMatrix in="blurMid" type="matrix" values="
          1 0 0 0 1.0
          0 1 0 0 0.92
          0 0 1 0 0.40
          0 0 0 1.5 0" result="goldMid"/>
        <feMerge>
          <feMergeNode in="goldWide"/>
          <feMergeNode in="goldMid"/>
          <feMergeNode in="blurSharp"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <g filter="url(#intenseGoldBloom)">
      ${content}
    </g>
  </svg>`;
}

async function main() {
  console.log('⚡ Generating 9jaBeacon Stickman Motivational Video Assets...');

  // 1. Render Background
  const bgSvg = generateBackgroundSvg();
  const bgPath = path.join(outputDir, 'background_cliff_gold.png');
  await sharp(Buffer.from(bgSvg))
    .png({ quality: 95 })
    .toFile(bgPath);
  console.log(`  ✅ Generated: ${bgPath} (1080x1920)`);

  // 2. Render 4 Stickman Character Poses
  const poses = ['standing', 'walking', 'leaping', 'victory'];
  for (const pose of poses) {
    const poseSvg = generateStickmanSvg(pose);
    const posePath = path.join(outputDir, `stickman_${pose}.png`);
    await sharp(Buffer.from(poseSvg))
      .png({ quality: 100 })
      .toFile(posePath);
    console.log(`  ✅ Generated: ${posePath} (500x500 Transparent Glow)`);
  }

  console.log('✨ Stickman asset synthesis complete!\n');
}

main().catch(err => {
  console.error('Error generating stickman assets:', err);
  process.exit(1);
});
