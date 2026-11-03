import type { RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { FormLayout } from '@/components/layout/FormLayout';
import { formRoutes, legacyFormRedirects } from '@/features/forms/registry';
import { LandingPage } from '@/features/landing';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { RequireAuth } from './guards/RequireAuth';
import { RequireOnboarding } from './guards/RequireOnboarding';
import { RequireRole } from './guards/RequireRole';

/**
 * Guard nesting (UX only; the database is the authority):
 *   /onboarding → RequireAuth
 *   /app        → RequireAuth → RequireOnboarding
 *   /admin      → RequireAuth → RequireOnboarding → RequireRole(allow: 'admin')
 * RequireOnboarding redirects to /onboarding and RequireRole to /app, so neither can loop.
 */
// Placeholders inside the auth card drop the page padding.
const inCard = 'p-0 sm:p-0';

export const routes: RouteObject[] = [
  {
    element: <FormLayout />,
    children: [
      {
        path: 'sign-in',
        // Lazy: keeps the Supabase client and zod off the landing page's critical path.
        lazy: async () => ({ Component: (await import('@/features/auth/SignInPage')).SignInPage }),
      },
      {
        path: 'sign-up',
        lazy: async () => ({ Component: (await import('@/features/auth/SignUpPage')).SignUpPage }),
      },
      {
        path: 'forgot-password',
        element: <PlaceholderPage page="forgotPassword" className={inCard} />,
      },
      // Forms system (SCRUM-34): /forms/<slug>, including request access (SCRUM-14).
      ...formRoutes,
      ...legacyFormRedirects,
      // Placeholders until page 3 (check email, confirmed).
      { path: 'check-email', element: <PlaceholderPage page="checkEmail" className={inCard} /> },
      {
        path: 'auth/confirmed',
        element: <PlaceholderPage page="authConfirmed" className={inCard} />,
      },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'onboarding', element: <PlaceholderPage page="onboarding" /> },
          {
            element: <RequireOnboarding />,
            children: [
              { path: 'app', element: <PlaceholderPage page="app" /> },
              {
                element: <RequireRole allow="admin" />,
                children: [{ path: 'admin', element: <PlaceholderPage page="admin" /> }],
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
