import type { NewsPresenter } from './types';

export const standardPoses = {
  idle: {
    x: '0%',
    y: '0%',
    name: 'Idle / Listening',
    description: 'Calm, attentive posture at newsroom desk'
  },
  speaking: {
    x: '100%',
    y: '0%',
    name: 'Active Reporting',
    description: 'Articulate delivery with natural hand gestures'
  },
  breaking: {
    x: '0%',
    y: '100%',
    name: 'Breaking News Alert',
    description: 'Urgent, high-focus breaking broadcast stance'
  },
  wrap: {
    x: '100%',
    y: '100%',
    name: 'Sign-off / Closing',
    description: 'Warm, confident smile for segment wrap-up'
  }
};

// 9JA BEACON 16-Pose Library Definition
export const corePoseLibrary = {
  idle: {
    id: 'idle',
    num: 1,
    name: 'Neutral / Idle',
    arm: 'hands_resting',
    gaze: 'gaze_camera',
    expression: 'neutral',
    mouth: 'closed',
    description: 'Sitting upright behind desk, both hands resting on desk, looking directly at camera, mouth closed'
  },
  speaking_desk: {
    id: 'speaking_desk',
    num: 2,
    name: 'Speaking — Hands on Desk',
    arm: 'hands_resting',
    gaze: 'gaze_camera',
    expression: 'neutral',
    mouth: 'open_medium',
    description: 'Same seated position, main default talking pose with natural mouth frames'
  },
  speaking_open_hands: {
    id: 'speaking_open_hands',
    num: 3,
    name: 'Speaking — Open Hands',
    arm: 'both_hands_open',
    gaze: 'gaze_camera',
    expression: 'friendly',
    mouth: 'open_medium',
    description: 'Both hands slightly apart, palms visible, used when explaining a story'
  },
  serious: {
    id: 'serious',
    num: 4,
    name: 'Serious Announcement',
    arm: 'hands_together',
    gaze: 'gaze_camera',
    expression: 'serious',
    mouth: 'closed',
    description: 'Upright posture, hands together, serious expression, direct eye contact'
  },
  breaking_alert: {
    id: 'breaking_alert',
    num: 5,
    name: 'Breaking-News Alert',
    arm: 'hand_open_left',
    gaze: 'gaze_camera',
    expression: 'urgent',
    mouth: 'open_wide',
    description: 'One hand raised slightly, alert/urgent expression, looking directly at camera'
  },
  point_left: {
    id: 'point_left',
    num: 6,
    name: 'Pointing Left',
    arm: 'point_left',
    gaze: 'gaze_left',
    expression: 'serious',
    mouth: 'open_small',
    description: 'One arm extended toward left, looks toward graphic, map or video'
  },
  point_right: {
    id: 'point_right',
    num: 7,
    name: 'Pointing Right',
    arm: 'point_right',
    gaze: 'gaze_right',
    expression: 'serious',
    mouth: 'open_small',
    description: 'One arm extended toward right, looks toward graphic or split-screen'
  },
  present_screen: {
    id: 'present_screen',
    num: 8,
    name: 'Presenting Screen',
    arm: 'explain_right',
    gaze: 'gaze_screen',
    expression: 'confident',
    mouth: 'open_medium',
    description: 'One arm extended with open palm, looking toward screen for normal explanations'
  },
  two_hand_explain: {
    id: 'two_hand_explain',
    num: 9,
    name: 'Two-Hand Explanation',
    arm: 'both_hands_open',
    gaze: 'gaze_camera',
    expression: 'concerned',
    mouth: 'open_medium',
    description: 'Both hands raised around chest level, palms facing outward for complicated info'
  },
  emphasis: {
    id: 'emphasis',
    num: 10,
    name: 'Emphasis Gesture',
    arm: 'emphasize_one',
    gaze: 'gaze_camera',
    expression: 'confident',
    mouth: 'open_medium',
    description: 'One hand raised with index finger, slight forward lean for key facts'
  },
  reading_bulletin: {
    id: 'reading_bulletin',
    num: 11,
    name: 'Reading Bulletin',
    arm: 'hold_paper',
    gaze: 'gaze_down',
    expression: 'serious',
    mouth: 'open_small',
    description: 'Looking downward at papers/tablet, one hand holding bulletin, other on desk'
  },
  teleprompter: {
    id: 'teleprompter',
    num: 12,
    name: 'Looking at Teleprompter',
    arm: 'hands_resting',
    gaze: 'gaze_screen',
    expression: 'neutral',
    mouth: 'open_medium',
    description: 'Eyes slightly off-camera, hands relaxed, speaking naturally'
  },
  listening: {
    id: 'listening',
    num: 13,
    name: 'Listening',
    arm: 'hands_together',
    gaze: 'gaze_camera',
    expression: 'neutral',
    mouth: 'closed',
    description: 'Mouth closed, slight head tilt, neutral attentive expression for correspondent/interview'
  },
  reacting: {
    id: 'reacting',
    num: 14,
    name: 'Reacting to Developing News',
    arm: 'hand_open_right',
    gaze: 'gaze_camera',
    expression: 'surprised',
    mouth: 'open_small',
    description: 'Slightly widened eyes, raised eyebrows, one hand lifted in reaction'
  },
  transition: {
    id: 'transition',
    num: 15,
    name: 'Transition Pose',
    arm: 'hands_together',
    gaze: 'gaze_camera',
    expression: 'neutral',
    mouth: 'closed',
    description: 'Hands together, looking at camera, neutral expression before switching scenes'
  },
  closing: {
    id: 'closing',
    num: 16,
    name: 'Closing Pose',
    arm: 'wave_goodbye',
    gaze: 'gaze_camera',
    expression: 'happy',
    mouth: 'smile',
    description: 'Relaxed smile, hands resting or waving, looking directly at camera for wrap-up'
  }
} as const;

export const presenters: NewsPresenter[] = [
  {
    id: 'presenter_stickman',
    name: 'Beacon Stickman Anchor',
    gender: 'male',
    role: 'Chief AI Broadcast Anchor & Newsroom Presenter',
    department: '9jaBeacon Automated Visual Newsroom',
    bio: 'Dynamic kinetic stickman broadcast presenter delivering fast, verified breaking bulletins, financial breakdowns, and investigative briefings with real-time lip-sync and modular gesture articulation.',
    avatar_url: '/presenters/stickman/stickman_avatar.svg',
    sprite_url: '/presenters/stickman/stickman_anchor_idle.svg',
    poses: standardPoses,
    preferred_categories: ['cat_naija_news', 'cat_politics', 'cat_security', 'cat_money_hustle', 'cat_world', 'cat_sports'],
    accent: 'Nigerian English (Crisp Broadcast / Baritone)',
    voice_settings: {
      pitch: 1.0,
      rate: 1.0,
      lang: 'en-NG',
      preferred_gender: 'male'
    },
    status: 'active',
    display_order: 1
  },
  {
    id: 'presenter_femi',
    name: 'Stickman Femi (National Affairs)',
    gender: 'male',
    role: 'Senior National Affairs & Breaking Politics Anchor',
    department: 'National Desk & Governance',
    bio: 'High-alert stickman anchor covering Aso Rock, presidential executive orders, national security briefings, and parliamentary debates.',
    avatar_url: '/presenters/stickman/stickman_anchor_breaking.svg',
    sprite_url: '/presenters/stickman/stickman_anchor_breaking.svg',
    poses: standardPoses,
    preferred_categories: ['cat_naija_news', 'cat_politics', 'cat_security'],
    accent: 'Nigerian English (Authoritative / Baritone)',
    voice_settings: {
      pitch: 0.95,
      rate: 1.0,
      lang: 'en-NG',
      preferred_gender: 'male'
    },
    status: 'active',
    display_order: 2
  },
  {
    id: 'presenter_amaka',
    name: 'Stickman Amaka (Investigative Desk)',
    gender: 'female',
    role: 'Chief Primetime & Special Investigative Anchor',
    department: 'Primetime & Investigative Unit',
    bio: 'Investigative stickman anchor analyzing policy accountability, civic transparency, human rights dossiers, and deep-dive public interest reports.',
    avatar_url: '/presenters/stickman/stickman_anchor_thinking.svg',
    sprite_url: '/presenters/stickman/stickman_anchor_thinking.svg',
    poses: standardPoses,
    preferred_categories: ['cat_naija_news', 'cat_politics', 'cat_world'],
    accent: 'Nigerian English (Clear / Crisp Soprano)',
    voice_settings: {
      pitch: 1.1,
      rate: 1.0,
      lang: 'en-NG',
      preferred_gender: 'female'
    },
    status: 'active',
    display_order: 3
  },
  {
    id: 'presenter_tunde',
    name: 'Stickman Tunde (Economy & Tech)',
    gender: 'male',
    role: 'Economy, Fintech & Business Intelligence Anchor',
    department: 'Money, Tech & Markets',
    bio: 'Data-driven stickman anchor pointing directly to live FX rates, Central Bank monetary updates, startup rounds, and wealth strategies.',
    avatar_url: '/presenters/stickman/stickman_anchor_pointing_screen.svg',
    sprite_url: '/presenters/stickman/stickman_anchor_pointing_screen.svg',
    poses: standardPoses,
    preferred_categories: ['cat_money_hustle', 'cat_tech_vibes'],
    accent: 'Nigerian English (Energetic / Analytical)',
    voice_settings: {
      pitch: 1.0,
      rate: 1.05,
      lang: 'en-NG',
      preferred_gender: 'male'
    },
    status: 'active',
    display_order: 4
  },
  {
    id: 'presenter_zainab',
    name: 'Stickman Zainab (Culture & Sports)',
    gender: 'female',
    role: 'Culture, Lifestyle & Global Diaspora Anchor',
    department: 'Culture, Sports & Global Affairs',
    bio: 'Triumphant stickman host chronicling Afrobeats global milestones, Super Eagles tournament victories, Nollywood releases, and African excellence.',
    avatar_url: '/presenters/stickman/stickman_anchor_victory.svg',
    sprite_url: '/presenters/stickman/stickman_anchor_victory.svg',
    poses: standardPoses,
    preferred_categories: ['cat_culture_lifestyle', 'cat_sports', 'cat_world'],
    accent: 'Nigerian English (Eloquent / Engaging)',
    voice_settings: {
      pitch: 1.05,
      rate: 0.98,
      lang: 'en-NG',
      preferred_gender: 'female'
    },
    status: 'active',
    display_order: 5
  }
];

export function getPresenterById(id: string): NewsPresenter | undefined {
  return presenters.find((p) => p.id === id);
}

export function getDefaultPresenterForCategory(categoryId?: string): NewsPresenter {
  if (!categoryId) return presenters[0];
  const matched = presenters.find((p) => p.preferred_categories.includes(categoryId));
  return matched || presenters[0];
}
