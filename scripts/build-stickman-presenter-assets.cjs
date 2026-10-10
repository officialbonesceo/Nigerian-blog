/**
 * 9jaBeacon Stickman Presenter Asset Synthesizer
 * Generates vector-pristine SVG and PNG assets for the official Stickman News Presenter.
 * Features modular poses: idle desk, speaking/reporting, breaking alert, pointing screen,
 * pointing map, investigative thinking, scoop victory, and sign-off wave.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const outDir = path.join(process.cwd(), 'public', 'presenters', 'stickman');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Common Stickman Presenter Defs
const commonDefs = `
  <defs>
    <!-- Radiant Golden Aura -->
    <radialGradient id="smAura" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fde047" stop-opacity="0.35"/>
      <stop offset="70%" stop-color="#eab308" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>

    <!-- Metallic Desk Gradient -->
    <linearGradient id="smDeskGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="25%" stop-color="#1e293b"/>
      <stop offset="50%" stop-color="#334155"/>
      <stop offset="75%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>

    <!-- Studio Neon Red Horizon -->
    <linearGradient id="smRedAccent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.2"/>
      <stop offset="50%" stop-color="#ef4444" stop-opacity="1"/>
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0.2"/>
    </linearGradient>

    <!-- Golden Stickman Stroke Glow -->
    <filter id="smGoldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="smAlertGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
`;

// Desk & Studio Environment Background
function getStudioBackdrop(opts = {}) {
  const isAlert = opts.alert || false;
  const isMarket = opts.market || false;

  const bgTop = isAlert ? '#1a0505' : isMarket ? '#021810' : '#030712';
  const bgBot = isAlert ? '#2d0a0a' : isMarket ? '#052e16' : '#0b1329';
  const accentColor = isAlert ? '#ef4444' : isMarket ? '#10b981' : '#38bdf8';

  return `
    <!-- Studio Cyc Wall -->
    <rect width="600" height="600" fill="${bgTop}"/>
    <rect y="240" width="600" height="360" fill="${bgBot}"/>

    <!-- Horizon LED Strip -->
    <rect y="240" width="600" height="4" fill="${accentColor}" opacity="0.85"/>
    <rect y="242" width="600" height="12" fill="${accentColor}" opacity="0.15"/>

    <!-- Studio Ceiling Grid & Lights -->
    <line x1="0" y1="60" x2="600" y2="60" stroke="#1e293b" stroke-width="2" stroke-dasharray="8 8"/>
    <line x1="0" y1="120" x2="600" y2="120" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="6 6"/>

    <!-- Studio Floor Reflection -->
    <rect y="390" width="600" height="210" fill="#090d16"/>
  `;
}

// 9jaBeacon Modern Curved Anchor Desk
function getNewsDesk(opts = {}) {
  const isAlert = opts.alert || false;
  const edgeColor = isAlert ? '#ef4444' : '#008751';

  return `
    <!-- Curved Anchor Desk Plinth -->
    <path d="M70 410 Q300 370 530 410 L510 590 Q300 560 90 590 Z" fill="url(#smDeskGrad)" stroke="#334155" stroke-width="2"/>

    <!-- Desk Surface Top Lip -->
    <path d="M60 410 Q300 365 540 410 L545 425 Q300 380 55 425 Z" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>

    <!-- Glowing 9jaBeacon Center Emblem -->
    <rect x="235" y="470" width="130" height="50" rx="8" fill="#090d16" stroke="${edgeColor}" stroke-width="2"/>
    <text x="300" y="495" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="900" letter-spacing="2" text-anchor="middle">9JABEACON</text>
    <text x="300" y="510" fill="${edgeColor}" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="700" letter-spacing="1.5" text-anchor="middle">LIVE NEWSROOM</text>

    <!-- Studio Mic on Desk -->
    <path d="M375 395 L375 365" stroke="#94a3b8" stroke-width="3"/>
    <rect x="368" y="348" width="14" height="20" rx="4" fill="#0f172a" stroke="#cbd5e1" stroke-width="1.5"/>
    <circle cx="375" cy="354" r="2.5" fill="#ef4444"/>

    <!-- Papers on Desk -->
    <rect x="180" y="395" width="45" height="28" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1" transform="rotate(-6 202 409)"/>
    <line x1="185" y1="403" x2="218" y2="399" stroke="#008751" stroke-width="1.5" transform="rotate(-6 202 409)"/>
    <line x1="185" y1="410" x2="214" y2="407" stroke="#64748b" stroke-width="1" transform="rotate(-6 202 409)"/>
    <line x1="185" y1="416" x2="210" y2="413" stroke="#64748b" stroke-width="1" transform="rotate(-6 202 409)"/>
  `;
}

// 1. Stickman Avatar (Close-up Head & Headset for profile icons)
function generateAvatarSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
    ${commonDefs}
    <rect width="256" height="256" rx="48" fill="#090d16"/>
    <circle cx="128" cy="128" r="110" fill="url(#smAura)"/>
    <circle cx="128" cy="128" r="115" fill="none" stroke="#eab308" stroke-width="3" stroke-dasharray="12 6" opacity="0.6"/>

    <!-- Stickman Head (Golden Glow Circle) -->
    <circle cx="128" cy="98" r="42" fill="#0f172a" stroke="#facc15" stroke-width="8" filter="url(#smGoldGlow)"/>

    <!-- Expressive Eyes -->
    <ellipse cx="114" cy="94" rx="5" ry="7" fill="#fef08a"/>
    <ellipse cx="142" cy="94" rx="5" ry="7" fill="#fef08a"/>

    <!-- Confident Anchor Smile -->
    <path d="M116 112 Q128 122 140 112" stroke="#facc15" stroke-width="4.5" fill="none" stroke-linecap="round"/>

    <!-- Broadcast Headset -->
    <path d="M82 92 Q128 46 174 92" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="80" y="86" width="10" height="22" rx="4" fill="#38bdf8"/>
    <rect x="166" y="86" width="10" height="22" rx="4" fill="#38bdf8"/>
    <path d="M86 102 Q100 126 122 124" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
    <circle cx="123" cy="124" r="4" fill="#ef4444"/>

    <!-- Neck & Body Line with Smart Anchor Crimson Tie -->
    <line x1="128" y1="140" x2="128" y2="200" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <line x1="78" y1="200" x2="128" y2="175" stroke="#facc15" stroke-width="7" stroke-linecap="round"/>
    <line x1="178" y1="200" x2="128" y2="175" stroke="#facc15" stroke-width="7" stroke-linecap="round"/>

    <!-- Crimson Necktie -->
    <polygon points="128,150 134,168 128,212 122,168" fill="#ef4444"/>
    <polygon points="124,148 132,148 130,154 126,154" fill="#b91c1c"/>

    <!-- Badge Label -->
    <rect x="74" y="214" width="108" height="24" rx="6" fill="#008751" stroke="#4ade80" stroke-width="1.5"/>
    <text x="128" y="230" fill="#ffffff" font-family="system-ui, sans-serif" font-size="11" font-weight="900" letter-spacing="1" text-anchor="middle">LIVE ANCHOR</text>
  </svg>`;
}

// 2. Idle Pose at Anchor Desk
function generatePoseIdleSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    ${commonDefs}
    ${getStudioBackdrop()}

    <!-- Golden Aura behind anchor -->
    <circle cx="300" cy="240" r="140" fill="url(#smAura)"/>

    <!-- ON AIR Studio Box in upper right -->
    <rect x="470" y="40" width="100" height="34" rx="6" fill="#0f172a" stroke="#ef4444" stroke-width="2"/>
    <circle cx="488" cy="57" r="5" fill="#ef4444" filter="url(#smAlertGlow)"/>
    <text x="532" y="62" fill="#ef4444" font-family="system-ui, sans-serif" font-size="13" font-weight="900" letter-spacing="2" text-anchor="middle">ON AIR</text>

    <!-- Studio Side Monitors -->
    <g opacity="0.85">
      <rect x="40" y="140" width="110" height="70" rx="6" fill="#0f172a" stroke="#334155" stroke-width="2"/>
      <polyline points="50,195 75,170 95,185 135,155" fill="none" stroke="#10b981" stroke-width="3"/>
      <text x="95" y="152" fill="#94a3b8" font-family="system-ui" font-size="8" font-weight="700" text-anchor="middle">FX RATES (NGN)</text>
    </g>

    <!-- STICKMAN ANCHOR BODY (Sitting behind desk) -->
    <!-- Spine -->
    <line x1="300" y1="180" x2="300" y2="390" stroke="#facc15" stroke-width="10" stroke-linecap="round" filter="url(#smGoldGlow)"/>

    <!-- Left Arm Resting on Desk -->
    <path d="M300 240 Q250 290 230 388" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="230" cy="388" r="8" fill="#fde047"/>

    <!-- Right Arm Resting on Desk -->
    <path d="M300 240 Q350 290 370 388" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="370" cy="388" r="8" fill="#fde047"/>

    <!-- Crimson Tie -->
    <polygon points="300,240 307,260 300,320 293,260" fill="#ef4444"/>

    <!-- Head -->
    <circle cx="300" cy="140" r="50" fill="#0f172a" stroke="#facc15" stroke-width="9" filter="url(#smGoldGlow)"/>
    <ellipse cx="284" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>
    <ellipse cx="316" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>
    <path d="M288 158 Q300 168 312 158" stroke="#facc15" stroke-width="4.5" fill="none" stroke-linecap="round"/>

    <!-- Broadcast Headset -->
    <path d="M246 136 Q300 80 354 136" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="242" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>
    <rect x="348" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>
    <path d="M250 148 Q268 174 294 172" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
    <circle cx="295" cy="172" r="4.5" fill="#ef4444"/>

    ${getNewsDesk()}
  </svg>`;
}

// 3. Speaking / Reporting Pose (Hands Explaining)
function generatePoseSpeakingSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    ${commonDefs}
    ${getStudioBackdrop()}

    <!-- Golden Aura with subtle talking pulse -->
    <circle cx="300" cy="240" r="160" fill="url(#smAura)"/>

    <!-- ON AIR Studio Box -->
    <rect x="470" y="40" width="100" height="34" rx="6" fill="#0f172a" stroke="#ef4444" stroke-width="2"/>
    <circle cx="488" cy="57" r="5" fill="#ef4444" filter="url(#smAlertGlow)"/>
    <text x="532" y="62" fill="#ef4444" font-family="system-ui, sans-serif" font-size="13" font-weight="900" letter-spacing="2" text-anchor="middle">ON AIR</text>

    <!-- Speech Waves Effect -->
    <path d="M360 140 Q380 140 380 150 Q380 160 360 160" fill="none" stroke="#38bdf8" stroke-width="2.5" opacity="0.8"/>
    <path d="M375 130 Q405 130 405 150 Q405 170 375 170" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.5"/>

    <!-- STICKMAN ANCHOR BODY -->
    <line x1="300" y1="180" x2="300" y2="390" stroke="#facc15" stroke-width="10" stroke-linecap="round" filter="url(#smGoldGlow)"/>

    <!-- Left Arm Gesturing Outwards (Explaining) -->
    <path d="M300 240 Q230 270 200 320" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="200" cy="320" r="8" fill="#fde047"/>
    <!-- Expressive hand lines -->
    <line x1="192" y1="312" x2="182" y2="304" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
    <line x1="192" y1="322" x2="178" y2="320" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>

    <!-- Right Arm Gesturing Forward -->
    <path d="M300 240 Q370 270 400 320" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="400" cy="320" r="8" fill="#fde047"/>
    <line x1="408" y1="312" x2="418" y2="304" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
    <line x1="408" y1="322" x2="422" y2="320" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>

    <!-- Crimson Tie -->
    <polygon points="300,240 307,260 300,320 293,260" fill="#ef4444"/>

    <!-- Head with Open Speaking Mouth -->
    <circle cx="300" cy="140" r="50" fill="#0f172a" stroke="#facc15" stroke-width="9" filter="url(#smGoldGlow)"/>
    <ellipse cx="284" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>
    <ellipse cx="316" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>

    <!-- Talking Open Mouth -->
    <ellipse cx="300" cy="162" rx="12" ry="9" fill="#e11d48"/>
    <path d="M290 159 Q300 156 310 159" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/>

    <!-- Headset -->
    <path d="M246 136 Q300 80 354 136" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="242" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>
    <rect x="348" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>
    <path d="M250 148 Q268 174 294 172" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
    <circle cx="295" cy="172" r="4.5" fill="#ef4444"/>

    ${getNewsDesk()}
  </svg>`;
}

// 4. Breaking News Emergency Alert
function generatePoseBreakingSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    ${commonDefs}
    ${getStudioBackdrop({ alert: true })}

    <!-- Red Alert Studio Strobe Glow -->
    <circle cx="300" cy="240" r="220" fill="url(#smAlertGlow)" opacity="0.3"/>

    <!-- Pulsing Red Siren in top center -->
    <rect x="220" y="25" width="160" height="40" rx="8" fill="#7f1d1d" stroke="#ef4444" stroke-width="3" filter="url(#smAlertGlow)"/>
    <text x="300" y="51" fill="#ffffff" font-family="system-ui, sans-serif" font-size="15" font-weight="900" letter-spacing="3" text-anchor="middle">🚨 BREAKING NEWS</text>

    <!-- STICKMAN ANCHOR (Urgent Alert Pose - Standing / Leaning forward) -->
    <line x1="300" y1="170" x2="300" y2="390" stroke="#facc15" stroke-width="10" stroke-linecap="round" filter="url(#smGoldGlow)"/>

    <!-- Left Arm Slammed/Urgent on Desk -->
    <path d="M300 230 Q240 270 210 370" fill="none" stroke="#facc15" stroke-width="8.5" stroke-linecap="round"/>
    <circle cx="210" cy="370" r="9" fill="#fde047"/>

    <!-- Right Arm Raised in High Alert / Pointing Upward -->
    <path d="M300 230 Q360 210 410 160" fill="none" stroke="#facc15" stroke-width="8.5" stroke-linecap="round"/>
    <circle cx="410" cy="160" r="9" fill="#fde047"/>
    <line x1="410" y1="155" x2="422" y2="135" stroke="#fde047" stroke-width="5" stroke-linecap="round"/>

    <!-- Crimson Tie (Swaying with urgency) -->
    <polygon points="300,230 310,250 305,320 295,250" fill="#ef4444"/>

    <!-- Alert Head (Eyes wide, serious urgent gaze) -->
    <circle cx="300" cy="130" r="50" fill="#0f172a" stroke="#facc15" stroke-width="9" filter="url(#smGoldGlow)"/>
    <!-- Wide Alert Eyes -->
    <circle cx="282" cy="126" r="8" fill="#fef08a"/>
    <circle cx="282" cy="126" r="4" fill="#0f172a"/>
    <circle cx="318" cy="126" r="8" fill="#fef08a"/>
    <circle cx="318" cy="126" r="4" fill="#0f172a"/>

    <!-- Wide Alert Open Mouth -->
    <polygon points="290,154 310,154 300,170" fill="#e11d48"/>

    <!-- Headset -->
    <path d="M246 126 Q300 70 354 126" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="242" y="118" width="10" height="24" rx="4" fill="#ef4444"/>
    <rect x="348" y="118" width="10" height="24" rx="4" fill="#ef4444"/>
    <path d="M250 138 Q268 164 294 162" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
    <circle cx="295" cy="162" r="4.5" fill="#ffffff"/>

    ${getNewsDesk({ alert: true })}
  </svg>`;
}

// 5. Pointing to Screen / Financial Chart (Markets & Data)
function generatePosePointScreenSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    ${commonDefs}
    ${getStudioBackdrop({ market: true })}

    <!-- Large Studio Video Wall / Chart Display on Right Side -->
    <rect x="370" y="80" width="200" height="180" rx="10" fill="#022c22" stroke="#10b981" stroke-width="3"/>
    <text x="470" y="105" fill="#34d399" font-family="system-ui" font-size="12" font-weight="900" letter-spacing="1" text-anchor="middle">CBN / FX INFLOWS</text>
    <polyline points="390,220 420,190 450,210 490,150 545,130" fill="none" stroke="#4ade80" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="545" cy="130" r="5" fill="#fde047" filter="url(#smGoldGlow)"/>
    <text x="470" y="246" fill="#f8fafc" font-family="system-ui" font-size="14" font-weight="900" text-anchor="middle">+ ₦1,420 / $1.00</text>

    <!-- STICKMAN ANCHOR (Turned toward screen, pointing directly at chart) -->
    <line x1="260" y1="180" x2="260" y2="390" stroke="#facc15" stroke-width="10" stroke-linecap="round" filter="url(#smGoldGlow)"/>

    <!-- Left Arm on Desk Holding Briefing Notes -->
    <path d="M260 240 Q210 280 180 370" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="180" cy="370" r="8" fill="#fde047"/>

    <!-- Right Arm Extended Pointing at the Chart -->
    <path d="M260 240 Q330 210 395 170" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="395" cy="170" r="8" fill="#fde047"/>
    <!-- Pointing Index Finger -->
    <line x1="395" y1="170" x2="425" y2="155" stroke="#fde047" stroke-width="5.5" stroke-linecap="round"/>

    <!-- Tie -->
    <polygon points="260,240 267,260 260,320 253,260" fill="#10b981"/>

    <!-- Head Turn Toward Screen (Looking Right) -->
    <circle cx="260" cy="140" r="50" fill="#0f172a" stroke="#facc15" stroke-width="9" filter="url(#smGoldGlow)"/>
    <!-- Eyes Gazing Right -->
    <ellipse cx="266" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>
    <ellipse cx="292" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>
    <path d="M272 158 Q284 166 296 158" stroke="#facc15" stroke-width="4.5" fill="none" stroke-linecap="round"/>

    <!-- Headset -->
    <path d="M210 136 Q260 80 310 136" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="206" y="128" width="10" height="24" rx="4" fill="#10b981"/>
    <rect x="306" y="128" width="10" height="24" rx="4" fill="#10b981"/>
    <path d="M210 148 Q230 174 256 172" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round"/>
    <circle cx="257" cy="172" r="4.5" fill="#ef4444"/>

    ${getNewsDesk({ market: true })}
  </svg>`;
}

// 6. Pointing to Map / Video Window (National / Security / World)
function generatePosePointMapSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    ${commonDefs}
    ${getStudioBackdrop()}

    <!-- Video Feed / Satellite Screen on Left Side -->
    <rect x="30" y="80" width="200" height="180" rx="10" fill="#0f172a" stroke="#38bdf8" stroke-width="3"/>
    <text x="130" y="105" fill="#38bdf8" font-family="system-ui" font-size="12" font-weight="900" letter-spacing="1" text-anchor="middle">LIVE SATELLITE FEED</text>
    <!-- Nigeria Map stylized contours -->
    <circle cx="130" cy="170" r="40" fill="#008751" opacity="0.3"/>
    <path d="M100 160 Q120 130 150 150 Q170 180 140 200 Q105 190 100 160 Z" fill="#008751" stroke="#4ade80" stroke-width="2"/>
    <circle cx="130" cy="165" r="4" fill="#ef4444" filter="url(#smAlertGlow)"/>
    <text x="130" y="246" fill="#f8fafc" font-family="system-ui" font-size="12" font-weight="800" text-anchor="middle">ABUJA / LAGOS AXIS</text>

    <!-- STICKMAN ANCHOR (Turned toward map, pointing left) -->
    <line x1="340" y1="180" x2="340" y2="390" stroke="#facc15" stroke-width="10" stroke-linecap="round" filter="url(#smGoldGlow)"/>

    <!-- Right Arm on Desk -->
    <path d="M340 240 Q390 280 420 370" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="420" cy="370" r="8" fill="#fde047"/>

    <!-- Left Arm Extended Pointing at the Map Feed -->
    <path d="M340 240 Q270 210 205 170" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="205" cy="170" r="8" fill="#fde047"/>
    <line x1="205" y1="170" x2="175" y2="155" stroke="#fde047" stroke-width="5.5" stroke-linecap="round"/>

    <!-- Tie -->
    <polygon points="340,240 347,260 340,320 333,260" fill="#ef4444"/>

    <!-- Head Turn Toward Left Screen -->
    <circle cx="340" cy="140" r="50" fill="#0f172a" stroke="#facc15" stroke-width="9" filter="url(#smGoldGlow)"/>
    <ellipse cx="314" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>
    <ellipse cx="338" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>
    <path d="M312 158 Q324 166 336 158" stroke="#facc15" stroke-width="4.5" fill="none" stroke-linecap="round"/>

    <!-- Headset -->
    <path d="M290 136 Q340 80 390 136" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="286" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>
    <rect x="386" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>

    ${getNewsDesk()}
  </svg>`;
}

// 7. Thinking / Investigative Mode (Hand on Chin / Dossier)
function generatePoseThinkingSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    ${commonDefs}
    ${getStudioBackdrop()}

    <!-- Moody Investigative Ambient Glow -->
    <circle cx="300" cy="200" r="160" fill="url(#smAura)" opacity="0.6"/>

    <!-- Dossier Confidential Stamp Graphic in Background -->
    <rect x="420" y="80" width="140" height="90" rx="4" fill="#1e293b" stroke="#cbd5e1" stroke-width="1.5" transform="rotate(8 490 125)"/>
    <text x="490" y="120" fill="#ef4444" font-family="system-ui" font-size="13" font-weight="900" letter-spacing="2" text-anchor="middle" transform="rotate(8 490 125)">CONFIDENTIAL</text>

    <!-- STICKMAN ANCHOR BODY -->
    <line x1="300" y1="180" x2="300" y2="390" stroke="#facc15" stroke-width="10" stroke-linecap="round" filter="url(#smGoldGlow)"/>

    <!-- Left Arm Holding Briefing Dossier Folder -->
    <path d="M300 240 Q240 280 230 360" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <rect x="200" y="340" width="55" height="40" rx="3" fill="#f59e0b" stroke="#b45309" stroke-width="2" transform="rotate(-10 227 360)"/>
    <circle cx="230" cy="360" r="8" fill="#fde047"/>

    <!-- Right Arm Bent Upward with Hand Touching Chin / In Thought -->
    <path d="M300 240 Q350 240 330 190 Q325 180 310 180" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="310" cy="180" r="9" fill="#fde047"/>

    <!-- Crimson Tie -->
    <polygon points="300,240 307,260 300,320 293,260" fill="#ef4444"/>

    <!-- Thinking Head (Slight Head Tilt, Inquisitive Brows) -->
    <circle cx="300" cy="140" r="50" fill="#0f172a" stroke="#facc15" stroke-width="9" filter="url(#smGoldGlow)"/>
    <!-- Focused Analytical Eyes (Looking Slightly Down at Desk Notes) -->
    <ellipse cx="284" cy="142" rx="6" ry="4" fill="#fef08a"/>
    <ellipse cx="316" cy="142" rx="6" ry="4" fill="#fef08a"/>
    <line x1="276" y1="130" x2="292" y2="133" stroke="#facc15" stroke-width="3" stroke-linecap="round"/>
    <line x1="324" y1="130" x2="308" y2="133" stroke="#facc15" stroke-width="3" stroke-linecap="round"/>
    <!-- Pensive Straight Mouth -->
    <line x1="292" y1="162" x2="308" y2="162" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>

    <!-- Headset -->
    <path d="M246 136 Q300 80 354 136" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="242" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>
    <rect x="348" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>

    ${getNewsDesk()}
  </svg>`;
}

// 8. Scoop Victory Celebration (Both Hands Raised / Golden Glow)
function generatePoseVictorySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    ${commonDefs}
    ${getStudioBackdrop()}

    <!-- Radiant Victory Starburst Aura -->
    <circle cx="300" cy="180" r="190" fill="url(#smAura)"/>
    <polygon points="300,30 315,100 380,50 350,115 420,100 365,150 430,180 360,200 400,260 340,230 350,300 300,250 250,300 260,230 200,260 240,200 170,180 235,150 180,100 250,115 220,50 285,100" fill="#fef08a" opacity="0.18"/>

    <!-- STICKMAN ANCHOR BODY -->
    <line x1="300" y1="180" x2="300" y2="390" stroke="#facc15" stroke-width="10" stroke-linecap="round" filter="url(#smGoldGlow)"/>

    <!-- Both Arms Triumphant in V-Shape -->
    <path d="M300 240 Q240 180 180 110" fill="none" stroke="#facc15" stroke-width="9" stroke-linecap="round"/>
    <circle cx="180" cy="110" r="10" fill="#fde047" filter="url(#smGoldGlow)"/>

    <path d="M300 240 Q360 180 420 110" fill="none" stroke="#facc15" stroke-width="9" stroke-linecap="round"/>
    <circle cx="420" cy="110" r="10" fill="#fde047" filter="url(#smGoldGlow)"/>

    <!-- Tie -->
    <polygon points="300,240 307,260 300,320 293,260" fill="#ef4444"/>

    <!-- Triumphant Smiling Head -->
    <circle cx="300" cy="140" r="50" fill="#0f172a" stroke="#facc15" stroke-width="9" filter="url(#smGoldGlow)"/>
    <!-- Joyful Eyes -->
    <path d="M280 136 Q286 128 292 136" stroke="#fef08a" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M308 136 Q314 128 320 136" stroke="#fef08a" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <!-- Big Victory Smile -->
    <path d="M284 152 Q300 174 316 152 Z" fill="#fef08a" stroke="#facc15" stroke-width="2"/>

    <!-- Headset -->
    <path d="M246 136 Q300 80 354 136" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="242" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>
    <rect x="348" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>

    ${getNewsDesk()}
  </svg>`;
}

// 9. Sign-off / Waving Wrap-up
function generatePoseWaveSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    ${commonDefs}
    ${getStudioBackdrop()}

    <!-- Golden Aura -->
    <circle cx="300" cy="240" r="140" fill="url(#smAura)"/>

    <!-- STICKMAN ANCHOR BODY -->
    <line x1="300" y1="180" x2="300" y2="390" stroke="#facc15" stroke-width="10" stroke-linecap="round" filter="url(#smGoldGlow)"/>

    <!-- Left Arm Resting on Desk -->
    <path d="M300 240 Q250 290 230 388" fill="none" stroke="#facc15" stroke-width="8" stroke-linecap="round"/>
    <circle cx="230" cy="388" r="8" fill="#fde047"/>

    <!-- Right Arm Waving Goodbye -->
    <path d="M300 240 Q370 200 390 140" fill="none" stroke="#facc15" stroke-width="8.5" stroke-linecap="round"/>
    <circle cx="390" cy="140" r="10" fill="#fde047"/>
    <!-- Waving Fingers -->
    <line x1="384" y1="130" x2="380" y2="114" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>
    <line x1="392" y1="128" x2="392" y2="110" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>
    <line x1="400" y1="132" x2="406" y2="116" stroke="#fde047" stroke-width="4" stroke-linecap="round"/>

    <!-- Tie -->
    <polygon points="300,240 307,260 300,320 293,260" fill="#ef4444"/>

    <!-- Warm Sign-off Smiling Head -->
    <circle cx="300" cy="140" r="50" fill="#0f172a" stroke="#facc15" stroke-width="9" filter="url(#smGoldGlow)"/>
    <ellipse cx="284" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>
    <ellipse cx="316" cy="136" rx="5.5" ry="7.5" fill="#fef08a"/>
    <path d="M286 156 Q300 170 314 156" stroke="#facc15" stroke-width="5" fill="none" stroke-linecap="round"/>

    <!-- Headset -->
    <path d="M246 136 Q300 80 354 136" fill="none" stroke="#94a3b8" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="242" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>
    <rect x="348" y="128" width="10" height="24" rx="4" fill="#38bdf8"/>

    ${getNewsDesk()}
  </svg>`;
}

async function main() {
  console.log('🎬 Synthesizing official Stickman News Presenter vector & raster assets...');

  const assetGenerators = [
    { name: 'stickman_avatar', svg: generateAvatarSvg(), width: 256, height: 256 },
    { name: 'stickman_anchor_idle', svg: generatePoseIdleSvg(), width: 600, height: 600 },
    { name: 'stickman_anchor_speaking', svg: generatePoseSpeakingSvg(), width: 600, height: 600 },
    { name: 'stickman_anchor_breaking', svg: generatePoseBreakingSvg(), width: 600, height: 600 },
    { name: 'stickman_anchor_pointing_screen', svg: generatePosePointScreenSvg(), width: 600, height: 600 },
    { name: 'stickman_anchor_pointing_map', svg: generatePosePointMapSvg(), width: 600, height: 600 },
    { name: 'stickman_anchor_thinking', svg: generatePoseThinkingSvg(), width: 600, height: 600 },
    { name: 'stickman_anchor_victory', svg: generatePoseVictorySvg(), width: 600, height: 600 },
    { name: 'stickman_anchor_signing_off', svg: generatePoseWaveSvg(), width: 600, height: 600 },
  ];

  for (const item of assetGenerators) {
    const svgPath = path.join(outDir, `${item.name}.svg`);
    const pngPath = path.join(outDir, `${item.name}.png`);

    fs.writeFileSync(svgPath, item.svg, 'utf8');
    await sharp(Buffer.from(item.svg))
      .resize(item.width, item.height)
      .png({ quality: 95 })
      .toFile(pngPath);

    console.log(`  ✅ Generated: ${item.name}.svg & ${item.name}.png`);
  }

  // Also create a copy as default avatar in /public/presenters/
  fs.copyFileSync(
    path.join(outDir, 'stickman_avatar.png'),
    path.join(process.cwd(), 'public', 'presenters', 'stickman_avatar.png')
  );
  fs.copyFileSync(
    path.join(outDir, 'stickman_avatar.svg'),
    path.join(process.cwd(), 'public', 'presenters', 'stickman_avatar.svg')
  );

  console.log('🎉 Stickman Presenter visual asset suite successfully created!');
}

main().catch(err => {
  console.error('Fatal error building stickman presenter assets:', err);
  process.exit(1);
});
