import {
  BadgeCheck,
  ClipboardCheck,
  Clock3,
  Lock,
  type LucideIcon,
  MailCheck,
  UserRoundCheck,
} from 'lucide-react';

interface BrandPanelContent {
  /** Large statement (a paragraph, never a heading). */
  statement: string;
  /** Exactly three short points with icons. */
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
    points: [
      { key: 'forms.interest.panel.minute', icon: Clock3 },
      { key: 'forms.interest.panel.noAccount', icon: UserRoundCheck },
      { key: 'forms.interest.panel.emailOnly', icon: MailCheck },
    ],
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
