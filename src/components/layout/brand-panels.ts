import { BadgeCheck, ClipboardCheck, Lock, type LucideIcon } from 'lucide-react';

interface BrandPanelContent {
  /** Large statement (a paragraph, never a heading). */
  statement: string;
  /** Up to three short points with icons; none renders no list. */
  points: readonly { key: string; icon: LucideIcon }[];
}

/** Brand panel content per form. Keys are i18n keys; add an entry for a new form. */
export const BRAND_PANELS = {
  auth: {
    statement: 'landing.hero.title',
    points: [
      { key: 'landing.trust.items.students.title', icon: BadgeCheck },
      { key: 'landing.trust.items.projects.title', icon: ClipboardCheck },
      { key: 'landing.trust.items.privacy.title', icon: Lock },
    ],
  },
  interest: {
    statement: 'forms.interest.panel.statement',
    points: [],
  },
} as const satisfies Record<string, BrandPanelContent>;

export type BrandPanelName = keyof typeof BRAND_PANELS;

export function isBrandPanelHandle(handle: unknown): handle is { brandPanel: BrandPanelName } {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'brandPanel' in handle &&
    typeof handle.brandPanel === 'string' &&
    handle.brandPanel in BRAND_PANELS
  );
}
