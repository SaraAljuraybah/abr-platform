import { Navigate, type RouteObject } from 'react-router';
import { RequestAccessRoute } from './RequestAccessRoute';

/**
 * Every form under /forms/<slug>, rendered in FormLayout. One entry per form: lazy-loaded, with
 * its brand panel content (src/components/layout/brand-panels.ts). An unknown slug matches no
 * route and falls through to the 404 page.
 */
export const formRoutes: RouteObject[] = [
  {
    path: 'forms/interest',
    handle: { brandPanel: 'interest' },
    lazy: async () => ({
      Component: (await import('./interest/InterestPage')).InterestPage,
    }),
  },
  // SCRUM-14 builds this form on the same system; placeholder until then.
  {
    path: 'forms/request-access',
    Component: RequestAccessRoute,
  },
];

/** The old address, kept for links already shared. */
export const legacyFormRedirects: RouteObject[] = [
  { path: 'request-access', element: <Navigate to="/forms/request-access" replace /> },
];
