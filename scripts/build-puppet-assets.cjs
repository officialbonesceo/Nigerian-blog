/**
 * 9jaBeacon Puppet Asset Synthesizer
 * Generates pristine, resolution-independent SVG & PNG puppet states for broadcast video rendering.
 * 
 * Each presenter gets:
 * - pose_book_closed.png (consulting briefing binder on desk, mouth closed)
 * - pose_book_speaking.png (consulting briefing binder on desk, mouth articulating downward)
 * - pose_aud_closed.png (looking forward at audience, arms rested, mouth closed)
 * - pose_aud_speaking.png (looking forward at audience, arms rested, mouth articulating on face)
 * - pose_screen_closed.png (head turned to side screen, arm pointing to screen, mouth closed)
 * - pose_screen_speaking.png (head turned to side screen, arm pointing to screen, mouth articulating)
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const presenters = [
  {
    id: 'femi',
    name: 'FEMI ADELEKE',
    skin1: '#5c3317',
    skin2: '#3d200d',
    suit1: '#1e293b',
    suit2: '#0f172a',
    shirt: '#f8fafc',
    tie: '#059669',
    knot: '#047857',
    hasGlasses: false,
    hasHijab: false
  },
  {
    id: 'amaka',
    name: 'AMAKA OKAFOR',
    skin1: '#783c28',
    skin2: '#542616',
    suit1: '#9f1239', // Ruby crimson
    suit2: '#881337',
    shirt: '#09090b',
    tie: '#f59e0b',
    knot: '#d97706',
    hasGlasses: false,
    hasHijab: false
  },
  {
    id: 'tunde',
    name: 'BABATUNDE BELLO',
    skin1: '#66361e',
    skin2: '#452210',
    suit1: '#334155', // Slate charcoal
    suit2: '#1e293b',
    shirt: '#e0f2fe',
    tie: '#831843',
    knot: '#701a75',
    hasGlasses: true,
    hasHijab: false
  },
  {
    id: 'zainab',
    name: 'ZAINAB ALIYU',
    skin1: '#7b4424',
    skin2: '#572c14',
    suit1: '#0f766e', // Deep royal teal
    suit2: '#115e59',
    shirt: '#f0fdfa',
    tie: '#f59e0b',
    knot: '#d97706',
    hasGlasses: false,
    hasHijab: true
  }
];

function generatePuppetSvg(p, gaze, arm, mouth) {
  // gaze: 'aud' | 'book' | 'screen'
  // arm: 'desk' | 'point' | 'hold'
  // mouth: 'closed' | 'open'

  return `
  <svg viewBox="0 0 500 500" width="720" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pSkin" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${p.skin1}" />
        <stop offset="100%" stop-color="${p.skin2}" />
      </linearGradient>
      <linearGradient id="pSuit" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${p.suit1}" />
        <stop offset="100%" stop-color="${p.suit2}" />
      </linearGradient>
      <linearGradient id="pDesk" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1e293b" />
        <stop offset="30%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <linearGradient id="pDeskRim" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#10b981" stop-opacity="0.2" />
        <stop offset="50%" stop-color="#34d399" stop-opacity="0.9" />
        <stop offset="100%" stop-color="#10b981" stop-opacity="0.2" />
      </linearGradient>
      <linearGradient id="pBookCover" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="50%" stop-color="#1e293b" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>

    <!-- Studio Back Halo -->
    <circle cx="250" cy="180" r="160" fill="none" stroke="#10b981" stroke-width="2" stroke-opacity="0.15" stroke-dasharray="8 6" />

    <!-- TORSO & SUIT -->
    <g id="torso">
      <path d="M 120 440 L 150 310 Q 190 280 250 280 Q 310 280 350 310 L 380 440 Z" fill="url(#pSuit)" />
      <path d="M 215 280 L 250 345 L 285 280 Z" fill="${p.shirt}" />
      ${p.hasHijab ? `
        <circle cx="250" cy="330" r="8" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" />
      ` : p.shirt === '#09090b' ? `
        <path d="M 225 305 Q 250 335 275 305" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" />
      ` : `
        <path d="M 243 295 L 257 295 L 260 380 L 250 395 L 240 380 Z" fill="${p.tie}" />
        <path d="M 242 295 L 258 295 L 255 315 L 245 315 Z" fill="${p.knot}" />
      `}
      <path d="M 175 305 L 225 385 L 210 440 L 140 440 Z" fill="${p.suit2}" />
      <path d="M 325 305 L 275 385 L 290 440 L 360 440 Z" fill="${p.suit2}" />
    </g>

    <!-- ARMS & HANDS -->
    ${arm === 'point' ? `
      <!-- Pointing to screen -->
      <path d="M 140 360 Q 145 425 205 435 L 215 415 Q 165 405 160 360 Z" fill="${p.suit2}" />
      <ellipse cx="212" cy="428" rx="14" ry="9" fill="url(#pSkin)" transform="rotate(-15 212 428)" />
      <path d="M 350 330 Q 395 315 440 280 L 450 300 Q 405 340 355 355 Z" fill="${p.suit1}" />
      <path d="M 440 280 L 465 260 L 472 268 L 448 295 Z" fill="url(#pSkin)" />
      <path d="M 465 260 L 485 245 L 488 252 L 470 266 Z" fill="url(#pSkin)" />
      <circle cx="468" cy="272" r="6" fill="url(#pSkin)" />
    ` : arm === 'hold' ? `
      <!-- Holding briefing notes on desk -->
      <path d="M 145 360 Q 160 415 200 425 L 210 405 Q 175 395 165 360 Z" fill="${p.suit2}" />
      <ellipse cx="204" cy="416" rx="12" ry="8" fill="url(#pSkin)" transform="rotate(25 204 416)" />
      <path d="M 355 360 Q 340 415 300 425 L 290 405 Q 325 395 335 360 Z" fill="${p.suit2}" />
      <ellipse cx="296" cy="416" rx="12" ry="8" fill="url(#pSkin)" transform="rotate(-25 296 416)" />
      <rect x="290" y="405" width="22" height="4" rx="2" fill="#f59e0b" transform="rotate(-35 290 405)" />
    ` : `
      <!-- Desk Rest -->
      <path d="M 140 360 Q 145 425 210 435 L 220 415 Q 165 405 160 360 Z" fill="${p.suit2}" />
      <ellipse cx="218" cy="428" rx="14" ry="9" fill="url(#pSkin)" transform="rotate(-15 218 428)" />
      <path d="M 360 360 Q 355 425 290 435 L 280 415 Q 335 405 340 360 Z" fill="${p.suit2}" />
      <ellipse cx="282" cy="428" rx="14" ry="9" fill="url(#pSkin)" transform="rotate(15 282 428)" />
    `}

    <!-- HEAD & FACE (Switchable Gaze & Articulated Mouth) -->
    ${gaze === 'book' ? `
      <!-- Head Tilted Downward at Book -->
      <path d="M 226 264 L 226 295 Q 250 305 274 295 L 274 264 Z" fill="url(#pSkin)" />
      <ellipse cx="250" cy="204" rx="58" ry="70" fill="url(#pSkin)" />
      ${p.hasHijab ? `
        <path d="M 184 195 C 184 120 316 120 316 195 C 316 260 306 295 284 305 C 270 310 230 310 216 305 C 194 295 184 260 184 195 Z" fill="#134e4a" opacity="0.95" />
        <path d="M 207 172 C 217 152 283 152 293 172 C 301 205 295 245 250 258 C 205 245 199 205 207 172 Z" fill="url(#pSkin)" />
        <path d="M 197 165 Q 250 148 303 165" fill="none" stroke="#f59e0b" stroke-width="2.5" />
      ` : `
        <path d="M 192 190 C 192 135 308 135 308 190 L 304 170 C 288 145 212 145 196 170 Z" fill="#09090b" />
      `}
      <!-- Eyes Cast Downward at Desk Notes -->
      <ellipse cx="228" cy="198" rx="8" ry="4" fill="#f8fafc" />
      <path d="M 220 196 Q 228 202 236 196" stroke="#18181b" stroke-width="2" fill="none" />
      <circle cx="228" cy="199" r="2.5" fill="#18181b" />
      <ellipse cx="272" cy="198" rx="8" ry="4" fill="#f8fafc" />
      <path d="M 264 196 Q 272 202 280 196" stroke="#18181b" stroke-width="2" fill="none" />
      <circle cx="272" cy="199" r="2.5" fill="#18181b" />
      <path d="M 218 190 Q 230 188 238 192" stroke="#18181b" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M 262 192 Q 270 188 282 190" stroke="#18181b" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M 248 204 L 246 220 L 254 220" stroke="${p.skin2}" stroke-width="2" fill="none" stroke-linecap="round" />
      
      <!-- Mouth for downward book gaze -->
      ${mouth === 'open' ? `
        <path d="M 235 237 Q 250 233 265 237 Q 260 250 250 250 Q 240 250 235 237 Z" fill="#7f1d1d" />
        <path d="M 238 238 Q 250 235 262 238 Q 258 247 250 247 Q 242 247 238 238 Z" fill="#260609" />
        <path d="M 241 238 Q 250 236 259 238 Q 257 241 250 241 Q 243 241 241 238 Z" fill="#ffffff" />
      ` : `
        <path d="M 236 238 Q 250 242 264 238" stroke="#451a03" stroke-width="3" fill="none" stroke-linecap="round" />
      `}
    ` : gaze === 'screen' ? `
      <!-- Head Turned Towards Side Screen -->
      <path d="M 232 260 L 235 290 Q 260 300 280 290 L 278 260 Z" fill="url(#pSkin)" />
      <ellipse cx="262" cy="194" rx="56" ry="72" fill="url(#pSkin)" />
      ${p.hasHijab ? `
        <path d="M 194 185 C 194 110 330 110 330 185 C 330 250 318 285 292 295 C 275 300 235 300 220 295 C 200 285 194 250 194 185 Z" fill="#134e4a" opacity="0.95" />
        <path d="M 220 160 C 230 140 298 140 306 160 C 314 195 308 235 264 250 C 218 235 212 195 220 160 Z" fill="url(#pSkin)" />
      ` : `
        <path d="M 205 180 C 205 125 320 125 320 180 L 315 160 C 300 135 225 135 210 160 Z" fill="#09090b" />
      `}
      <ellipse cx="246" cy="188" rx="8" ry="6" fill="#f8fafc" />
      <circle cx="250" cy="188" r="4" fill="#18181b" />
      <ellipse cx="286" cy="188" rx="8" ry="6" fill="#f8fafc" />
      <circle cx="290" cy="188" r="4" fill="#18181b" />
      <path d="M 238 178 Q 248 174 258 178" stroke="#18181b" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M 278 176 Q 288 172 298 177" stroke="#18181b" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M 268 192 L 274 212 L 268 214" stroke="${p.skin2}" stroke-width="2" fill="none" stroke-linecap="round" />

      <!-- Mouth turned to screen -->
      ${mouth === 'open' ? `
        <path d="M 250 231 Q 266 226 280 229 Q 275 244 265 245 Q 256 245 250 231 Z" fill="#7f1d1d" />
        <path d="M 253 232 Q 266 228 277 231 Q 273 241 265 242 Q 258 242 253 232 Z" fill="#260609" />
        <path d="M 256 232 Q 266 229 274 231 Q 272 235 265 235 Q 260 235 256 232 Z" fill="#ffffff" />
      ` : `
        <path d="M 252 232 Q 266 235 280 230" stroke="#451a03" stroke-width="3" fill="none" stroke-linecap="round" />
      `}
    ` : `
      <!-- Head Facing Audience -->
      <path d="M 225 260 L 225 290 Q 250 300 275 290 L 275 260 Z" fill="url(#pSkin)" />
      <ellipse cx="250" cy="195" rx="60" ry="72" fill="url(#pSkin)" />
      ${p.hasHijab ? `
        <path d="M 180 185 C 180 110 320 110 320 185 C 320 250 310 285 285 295 C 270 300 230 300 215 295 C 190 285 180 250 180 185 Z" fill="#134e4a" opacity="0.95" />
        <path d="M 205 160 C 215 140 285 140 295 160 C 305 195 300 235 250 250 C 200 235 195 195 205 160 Z" fill="url(#pSkin)" />
        <path d="M 195 155 Q 250 138 305 155" fill="none" stroke="#f59e0b" stroke-width="2.5" />
      ` : `
        <path d="M 190 180 C 190 125 310 125 310 180 L 305 160 C 290 135 210 135 195 160 Z" fill="#09090b" />
      `}
      <ellipse cx="228" cy="188" rx="9" ry="6" fill="#f8fafc" />
      <circle cx="228" cy="188" r="4" fill="#18181b" />
      <circle cx="229" cy="186" r="1.5" fill="#ffffff" />
      <ellipse cx="272" cy="188" rx="9" ry="6" fill="#f8fafc" />
      <circle cx="272" cy="188" r="4" fill="#18181b" />
      <circle cx="273" cy="186" r="1.5" fill="#ffffff" />
      <path d="M 218 178 Q 230 173 240 177" stroke="#18181b" stroke-width="2.5" fill="none" stroke-linecap="round" />
      <path d="M 260 177 Q 270 173 282 178" stroke="#18181b" stroke-width="2.5" fill="none" stroke-linecap="round" />
      ${p.hasGlasses ? `
        <rect x="215" y="180" width="28" height="18" rx="3" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <rect x="257" y="180" width="28" height="18" rx="3" fill="none" stroke="#0f172a" stroke-width="2.5" />
        <path d="M 243 186 L 257 186" stroke="#0f172a" stroke-width="2.5" />
      ` : ''}
      <path d="M 248 194 Q 250 208 244 214 Q 250 216 256 214" stroke="${p.skin2}" stroke-width="2" fill="none" stroke-linecap="round" />

      <!-- Mouth for Audience Face -->
      ${mouth === 'open' ? `
        <path d="M 232 230 Q 250 224 268 230 Q 262 248 250 248 Q 238 248 232 230 Z" fill="#7f1d1d" />
        <path d="M 235 231 Q 250 227 265 231 Q 260 245 250 245 Q 240 245 235 231 Z" fill="#260609" />
        <path d="M 239 231 Q 250 228 261 231 Q 259 236 250 236 Q 241 236 239 231 Z" fill="#ffffff" />
        <ellipse cx="250" cy="242" rx="7" ry="3" fill="#f43f5e" opacity="0.8" />
      ` : `
        <path d="M 234 232 Q 250 236 266 232" stroke="#451a03" stroke-width="3" fill="none" stroke-linecap="round" />
      `}
    `}

    <!-- FOREGROUND DESK & BRIEFING PROPS -->
    <g id="desk-foreground">
      <path d="M 20 420 L 480 420 L 500 500 L 0 500 Z" fill="url(#pDesk)" />
      <line x1="20" y1="420" x2="480" y2="420" stroke="url(#pDeskRim)" stroke-width="4" />
      
      <!-- Briefing Folder with Document Lines -->
      <polygon points="175,426 325,426 345,488 155,488" fill="url(#pBookCover)" stroke="#334155" stroke-width="1.5" />
      <polygon points="185,430 315,430 330,482 170,482" fill="#f8fafc" />
      <rect x="195" y="438" width="110" height="4" rx="1" fill="#047857" />
      <line x1="195" y1="448" x2="305" y2="448" stroke="#64748b" stroke-width="2" stroke-linecap="round" />
      <line x1="195" y1="456" x2="295" y2="456" stroke="#64748b" stroke-width="2" stroke-linecap="round" />
      <line x1="195" y1="464" x2="280" y2="464" stroke="#64748b" stroke-width="2" stroke-linecap="round" />
      <line x1="195" y1="472" x2="290" y2="472" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3" />

      <!-- Studio Mic -->
      <ellipse cx="90" cy="455" rx="14" ry="6" fill="#09090b" stroke="#334155" stroke-width="1" />
      <path d="M 90 455 Q 85 410 115 385" fill="none" stroke="#475569" stroke-width="4" stroke-linecap="round" />
      <rect x="110" y="372" width="22" height="14" rx="4" fill="#09090b" stroke="#10b981" stroke-width="1.5" transform="rotate(-25 110 372)" />

      <!-- Brass Desk Nameplate -->
      <polygon points="190,490 310,490 305,498 195,498" fill="#d97706" />
      <text x="250" y="496" font-size="7" font-weight="900" font-family="monospace" fill="#ffffff" text-anchor="middle" letter-spacing="1">
        ${p.name}
      </text>
    </g>
  </svg>
  `;
}

function generateBrollCardSvg() {
  return `
  <svg viewBox="0 0 1920 1080" width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#020617" />
        <stop offset="50%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#064e3b" />
      </linearGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#bgGrad)" />
    <!-- Grid -->
    <line x1="0" y1="360" x2="1920" y2="360" stroke="#1e293b" stroke-width="1" opacity="0.4" />
    <line x1="0" y1="720" x2="1920" y2="720" stroke="#1e293b" stroke-width="1" opacity="0.4" />
    <line x1="640" y1="0" x2="640" y2="1080" stroke="#1e293b" stroke-width="1" opacity="0.4" />
    <line x1="1280" y1="0" x2="1280" y2="1080" stroke="#1e293b" stroke-width="1" opacity="0.4" />

    <!-- Center Box -->
    <rect x="260" y="200" width="1400" height="600" rx="24" fill="#090d16" stroke="#10b981" stroke-width="2" opacity="0.95" />

    <!-- Top Badge -->
    <rect x="300" y="240" width="220" height="48" rx="8" fill="#dc2626" />
    <text x="410" y="272" font-size="22" font-weight="900" font-family="monospace" fill="#ffffff" text-anchor="middle">LIVE REPORT</text>
    
    <text x="550" y="272" font-size="22" font-weight="900" font-family="monospace" fill="#34d399">VERIFIED ARCHIVE // FIELD TRANSMISSION</text>
    
    <!-- Headline Card inside B-Roll -->
    <text x="300" y="420" font-size="44" font-weight="900" font-family="sans-serif" fill="#ffffff">FIELD DISPATCH: REAL-TIME ON-SCENE MONITORED UPDATE</text>
    <text x="300" y="480" font-size="26" font-family="monospace" fill="#94a3b8">Continuous background tension audio active • High-resolution verified citizen documentation</text>

    <!-- Visualizer Waveform -->
    <g transform="translate(300, 600)">
      <rect x="0" y="10" width="12" height="40" rx="6" fill="#10b981" />
      <rect x="24" y="0" width="12" height="60" rx="6" fill="#34d399" />
      <rect x="48" y="15" width="12" height="35" rx="6" fill="#10b981" />
      <rect x="72" y="5" width="12" height="50" rx="6" fill="#34d399" />
      <rect x="96" y="20" width="12" height="25" rx="6" fill="#10b981" />
      <rect x="120" y="0" width="12" height="60" rx="6" fill="#34d399" />
      <rect x="144" y="12" width="12" height="38" rx="6" fill="#10b981" />
      <rect x="168" y="25" width="12" height="20" rx="6" fill="#10b981" />
      <text x="210" y="40" font-size="20" font-family="monospace" fill="#34d399">LIVE AUDIO BED CONTINUITY ACTIVE</text>
    </g>

    <!-- Bottom Tag -->
    <text x="300" y="740" font-size="20" font-family="monospace" fill="#64748b">9jaBEACON INDEPENDENT NEWSROOM • REAL-TIME NATIONWIDE DESK</text>
  </svg>
  `;
}

async function buildAllPuppetAssets() {
  const outDir = path.join(process.cwd(), 'public', 'presenters', 'puppet');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('🎨 Rendering modular broadcast puppet assets for all presenters...');

  for (const p of presenters) {
    const states = [
      { name: 'pose_book_closed', gaze: 'book', arm: 'hold', mouth: 'closed' },
      { name: 'pose_book_speaking', gaze: 'book', arm: 'hold', mouth: 'open' },
      { name: 'pose_aud_closed', gaze: 'aud', arm: 'desk', mouth: 'closed' },
      { name: 'pose_aud_speaking', gaze: 'aud', arm: 'desk', mouth: 'open' },
      { name: 'pose_screen_closed', gaze: 'screen', arm: 'point', mouth: 'closed' },
      { name: 'pose_screen_speaking', gaze: 'screen', arm: 'point', mouth: 'open' }
    ];

    for (const s of states) {
      const svg = generatePuppetSvg(p, s.gaze, s.arm, s.mouth);
      const filename = `${p.id}_${s.name}.png`;
      const filePath = path.join(outDir, filename);

      await sharp(Buffer.from(svg))
        .png({ quality: 95 })
        .toFile(filePath);

      console.log(`  ✓ Generated: ${filename}`);
    }
  }

  // Generate B-roll card
  const brollSvg = generateBrollCardSvg();
  const brollPath = path.join(outDir, 'broll_interstitial.png');
  await sharp(Buffer.from(brollSvg)).png({ quality: 95 }).toFile(brollPath);
  console.log('  ✓ Generated: broll_interstitial.png');

  console.log('🎉 All modular broadcast puppet assets successfully built!');
}

buildAllPuppetAssets().catch(err => {
  console.error('Asset build failed:', err);
  process.exit(1);
});
