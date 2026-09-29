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

export const presenters: NewsPresenter[] = [
  {
    id: 'presenter_femi',
    name: 'Femi Adeleke',
    gender: 'male',
    role: 'Senior National Affairs & Breaking Politics Anchor',
    department: 'National Desk & Governance',
    bio: 'Authoritative broadcast journalist with over a decade covering Aso Rock, presidential directives, legislative debates, and national security briefings across Nigeria.',
    avatar_url: '/presenters/femi.jpg',
    sprite_url: '/presenters/femi.jpg',
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
    display_order: 1
  },
  {
    id: 'presenter_amaka',
    name: 'Amaka Okafor',
    gender: 'female',
    role: 'Chief Primetime & Special Investigative Anchor',
    department: 'Primetime & Investigative Unit',
    bio: 'Renowned investigative journalist and evening news anchor known for razor-sharp reporting on civic accountability, economy, human rights, and breaking national developments.',
    avatar_url: '/presenters/amaka.jpg',
    sprite_url: '/presenters/amaka.jpg',
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
    display_order: 2
  },
  {
    id: 'presenter_tunde',
    name: 'Babatunde Bello',
    gender: 'male',
    role: 'Economy, Fintech & Business Intelligence Anchor',
    department: 'Money, Tech & Markets',
    bio: 'Financial analyst and modern tech presenter decoding Central Bank monetary shifts, FX markets, Nigerian startup ecosystems, and practical wealth strategies.',
    avatar_url: '/presenters/tunde.jpg',
    sprite_url: '/presenters/tunde.jpg',
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
    display_order: 3
  },
  {
    id: 'presenter_zainab',
    name: 'Zainab Aliyu',
    gender: 'female',
    role: 'Culture, Lifestyle & Global Diaspora Anchor',
    department: 'Culture, Sports & Global Affairs',
    bio: 'Dynamic broadcast journalist chronicling Nollywood, Afrobeats global milestones, African diaspora excellence, grassroots sports, and cross-continental cultural narratives.',
    avatar_url: '/presenters/zainab.jpg',
    sprite_url: '/presenters/zainab.jpg',
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
    display_order: 4
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
