/** Landing page section anchors, shared by the header, mobile menu and footer. */
export const LANDING_SECTIONS = [
  { id: 'how-it-works', labelKey: 'nav.sections.howItWorks' },
  { id: 'who-its-for', labelKey: 'nav.sections.whoItsFor' },
  { id: 'trust', labelKey: 'nav.sections.trust' },
  { id: 'faq', labelKey: 'nav.sections.faq' },
] as const;

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]['id'];
