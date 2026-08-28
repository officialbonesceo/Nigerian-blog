export const EDITORIAL_PROFILES = {
  cat_naija_news: {
    name: '9jaBeacon News Team',
    role: 'National News Editorial Desk',
    avatar: '/editorial/naija-news-team.svg',
  },
  cat_money_hustle: {
    name: '9jaBeacon Financial Team',
    role: 'Money & Markets Editorial Desk',
    avatar: '/editorial/finance-team.svg',
  },
  cat_sports: {
    name: '9jaBeacon Sports Team',
    role: 'Sports Editorial Desk',
    avatar: '/editorial/sports-team.svg',
  },
  cat_world: {
    name: '9jaBeacon World Team',
    role: 'World Affairs Editorial Desk',
    avatar: '/editorial/world-team.svg',
  },
} as const;

export const DEFAULT_EDITORIAL_PROFILE = {
  name: '9jaBeacon Editorial Team',
  role: 'Editorial Desk',
  avatar: '/editorial/naija-news-team.svg',
} as const;

export type EditorialCategoryId = keyof typeof EDITORIAL_PROFILES;

export function getEditorialProfile(categoryId?: string) {
  return (categoryId && EDITORIAL_PROFILES[categoryId as EditorialCategoryId]) || DEFAULT_EDITORIAL_PROFILE;
}
