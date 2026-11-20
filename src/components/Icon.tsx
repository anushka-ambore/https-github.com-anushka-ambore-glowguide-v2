import type { ReactNode } from 'react'

export type IconName = 'home' | 'check' | 'sparkles' | 'trend' | 'products' | 'user' | 'leafSparkle' | 'drop' | 'chevron' | 'plus' | 'arrow' | 'sun' | 'heart' | 'trash'

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  check: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="m8 12 2.5 2.5L16.5 8" /></>,
  sparkles: <><path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Z" /><path d="m5 15 .6 2.4L8 18l-2.4.6L5 21l-.6-2.4L2 18l2.4-.6L5 15Z" /></>,
  trend: <><path d="M3 18 8.5 12l4 3L21 6" /><path d="M15 6h6v6" /></>,
  products: <><path d="M7 3h10v4H7zM6 7h12v14H6z" /><path d="M9 11h6M9 15h6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4.2 3.5-6 8-6s7.2 1.8 8 6" /></>,
  leafSparkle: <><path d="M20 4c-9 0-15 3-15 10a6 6 0 0 0 6 6c7 0 9-7 9-16Z" /><path d="M5 19c3-4 6-6 11-9M17 3l.7 2.3L20 6l-2.3.7L17 9l-.7-2.3L14 6l2.3-.7L17 3Z" /></>,
  drop: <path d="M12 3S6.5 9.2 6.5 14a5.5 5.5 0 0 0 11 0C17.5 9.2 12 3 12 3Z" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  trash: <><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" /></>,
}

export function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}
