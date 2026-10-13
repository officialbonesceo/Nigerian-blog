/**
 * 9JA BEACON — Production Broadcast Package
 * Episode: NYSC Imo Rescue (Desk Brief)
 * Format: 60s horizontal + 9:16 vertical alternate
 * Excludes: street interview / citizen reaction segment
 */

export const BROADCAST_VOICE = {
  engine: 'edge-tts',
  /** Primary anchor voice — clear, formal Nigerian English */
  voice: 'en-NG-EzinneNeural',
  /** Fallback if NG neural unavailable on runner */
  voiceFallback: 'en-GB-SoniaNeural',
  rate: '+0%',
  pitch: '+0Hz',
  volume: '+0%',
  style: 'newscast-formal',
  notes:
    'Edge TTS en-NG-EzinneNeural is the locked channel voice for Desk Briefs until Kokoro/cloned voice is approved. Do not mix voices within one episode.',
} as const;

export const BROADCAST_STUDIO = {
  look: '9jaBeacon Dark News Desk',
  palette: {
    bg: '#0a1628',
    accent: '#e11d48',
    lowerThirdBlue: '#1e3a8a',
    lowerThirdRed: '#dc2626',
    livePill: '#ef4444',
  },
  elements: [
    '9JA BEACON LIVE bug (top-right)',
    'Breaking News red bar',
    'Headline lower-third',
    'Subhead ticker line',
    'Dark LED studio backdrop',
    'Stickman red-tie anchor at desk',
  ],
  aspectPrimary: '16:9',
  aspectShorts: '9:16',
} as const;

export interface BroadcastSegment {
  id: string;
  order: number;
  title: string;
  startSec: number;
  endSec: number;
  stage: 'logo' | 'studio' | 'b_roll' | 'map' | 'data' | 'outro';
  stickman: {
    desk: boolean;
    motion: 'idle' | 'walk_left' | 'walk_right';
    armPose: string;
    expression: string;
    gaze: string;
    talking: boolean;
  };
  graphics: {
    breakingBar?: string;
    headline?: string;
    subhead?: string;
    dataCards?: { label: string; value: string }[];
    mapCaption?: string;
  };
  /** Exact words for TTS — speak this only */
  voiceover: string;
}

export const NYSC_IMO_RESCUE_PACKAGE = {
  id: 'pkg_nysc_imo_rescue_20261013',
  status: 'ready_to_render' as const,
  channel: '9JA BEACON',
  format: 'Desk Brief — 60s',
  article: {
    slug: 'twenty-prospective-nysc-members-rescued-after-week-long-kidnapping-in-imo-state',
    url: 'https://www.9jabeacon.name.ng/news/twenty-prospective-nysc-members-rescued-after-week-long-kidnapping-in-imo-state',
    title: 'Twenty Prospective NYSC Members Rescued After Week-Long Kidnapping in Imo State',
    source: 'Punch Newspapers / 9jaBeacon Editorial',
    publishedAt: '2026-10-09T00:21:00+01:00',
  },
  voice: BROADCAST_VOICE,
  studio: BROADCAST_STUDIO,
  totalDurationSec: 60,
  excluded: ['interviews', 'street_scene', 'citizen_reaction'] as const,
  youtube: {
    title: 'BREAKING: 20 Prospective NYSC Members Rescued After Week in Captivity | 9jaBeacon',
    description: [
      'Twenty prospective National Youth Service Corps members abducted in Imo State have been freed after seven days and reunited with families in Ibadan.',
      '',
      'Full story: https://www.9jabeacon.name.ng/news/twenty-prospective-nysc-members-rescued-after-week-long-kidnapping-in-imo-state',
      '',
      '9jaBeacon — Real News · Real Time · For You',
      'Subscribe for daily Nigerian desk briefs.',
    ].join('\n'),
    tags: ['Nigeria', 'NYSC', 'Imo', 'Breaking News', '9jaBeacon', 'Security'],
    shortsTitle: '20 NYSC members rescued after 7 days | 9jaBeacon',
  },
  segments: [
    {
      id: 'seg_logo',
      order: 1,
      title: '1. Intro / Logo Animation',
      startSec: 0,
      endSec: 4,
      stage: 'logo',
      stickman: {
        desk: false,
        motion: 'idle',
        armPose: 'sideway',
        expression: 'neutral',
        gaze: 'straight',
        talking: false,
      },
      graphics: {
        headline: '9JA BEACON',
        subhead: 'REAL NEWS · REAL TIME · FOR YOU',
      },
      voiceover: '',
    },
    {
      id: 'seg_intro',
      order: 2,
      title: '2. Anchor Introduction',
      startSec: 4,
      endSec: 14,
      stage: 'studio',
      stickman: {
        desk: true,
        motion: 'idle',
        armPose: 'desk-rest',
        expression: 'serious',
        gaze: 'straight',
        talking: true,
      },
      graphics: {
        breakingBar: 'BREAKING NEWS',
        headline: 'NYSC MEMBERS RESCUED IN IMO',
        subhead: 'Stay informed | 9jaBeacon — Your trusted news source',
      },
      voiceover:
        'Good evening. This is 9jaBeacon. We start with breaking news from the Southeast. Twenty prospective National Youth Service Corps members, abducted in Imo State, have been rescued after a week in captivity.',
    },
    {
      id: 'seg_visual',
      order: 3,
      title: '3. News Visual / Context',
      startSec: 14,
      endSec: 26,
      stage: 'b_roll',
      stickman: {
        desk: true,
        motion: 'idle',
        armPose: 'desk-rest',
        expression: 'serious',
        gaze: 'straight',
        talking: true,
      },
      graphics: {
        breakingBar: 'BREAKING NEWS',
        headline: 'WEEK-LONG ORDEAL ENDS IN FREEDOM',
        subhead: 'Abducted while travelling — families reunited in Ibadan',
      },
      voiceover:
        'The graduates were seized while travelling in Imo, a state that has seen a rise in kidnapping-for-ransom along major routes. After seven days in the hands of their abductors, all twenty regained their freedom.',
    },
    {
      id: 'seg_data',
      order: 4,
      title: '4. Explanation / Key Figures',
      startSec: 26,
      endSec: 38,
      stage: 'data',
      stickman: {
        desk: true,
        motion: 'idle',
        armPose: 'gesture',
        expression: 'serious',
        gaze: 'straight',
        talking: true,
      },
      graphics: {
        breakingBar: 'KEY FIGURES',
        headline: 'WHAT WE KNOW',
        dataCards: [
          { label: 'Rescued', value: '20 corps members' },
          { label: 'Captivity', value: '7 days' },
          { label: 'Location', value: 'Imo State' },
          { label: 'Reunion', value: 'Ibadan, Oyo State' },
        ],
      },
      voiceover:
        'Here is what we know. Twenty prospective corps members. Seven days in captivity. Abducted in Imo State. Reunited with their families in Ibadan, the Oyo State capital. Security agencies have not released full operational details of the rescue.',
    },
    {
      id: 'seg_map',
      order: 5,
      title: '5. Map / Route Context',
      startSec: 38,
      endSec: 48,
      stage: 'map',
      stickman: {
        desk: true,
        motion: 'idle',
        armPose: 'point-right',
        expression: 'concerned',
        gaze: 'side',
        talking: true,
      },
      graphics: {
        breakingBar: 'SECURITY WATCH',
        headline: 'SOUTHEAST TRAVEL RISK',
        mapCaption: 'Imo → rescue corridor → family reunion in Ibadan',
        subhead: 'Prospective corps members remain at risk on highway routes',
      },
      voiceover:
        'The case renews urgent questions about the safety of young Nigerians travelling to NYSC orientation camps, especially through high-risk corridors in the Southeast.',
    },
    {
      id: 'seg_summary',
      order: 6,
      title: '6. Anchor Summary',
      startSec: 48,
      endSec: 56,
      stage: 'studio',
      stickman: {
        desk: true,
        motion: 'idle',
        armPose: 'desk-rest',
        expression: 'serious',
        gaze: 'straight',
        talking: true,
      },
      graphics: {
        breakingBar: 'BREAKING NEWS',
        headline: 'FAMILIES REUNITED — QUESTIONS REMAIN',
        subhead: 'Stakeholders call for safer travel corridors for corps members',
        dataCards: [
          { label: 'Outcome', value: 'All 20 freed' },
          { label: 'Next focus', value: 'Route security' },
        ],
      },
      voiceover:
        'For now, the families have their children back. The bigger picture remains clear: Nigeria must secure the roads that take our graduates to service. We will continue to follow this story.',
    },
    {
      id: 'seg_outro',
      order: 7,
      title: '7. Outro / Subscribe',
      startSec: 56,
      endSec: 60,
      stage: 'outro',
      stickman: {
        desk: true,
        motion: 'idle',
        armPose: 'wave',
        expression: 'happy',
        gaze: 'straight',
        talking: true,
      },
      graphics: {
        headline: '9JA BEACON',
        subhead: 'REAL NEWS · REAL TIME · FOR YOU',
      },
      voiceover: 'This is 9jaBeacon. Stay informed. Subscribe for more.',
    },
  ] as BroadcastSegment[],
  /** Full VO concatenated for one-shot TTS (segments with speech only) */
  get fullVoiceoverScript(): string {
    return this.segments
      .map((s) => s.voiceover.trim())
      .filter(Boolean)
      .join(' ');
  },
};

export type BroadcastPackage = typeof NYSC_IMO_RESCUE_PACKAGE;
