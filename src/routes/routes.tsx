import type { RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
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
    element: <AuthLayout />,
    children: [
      {
        path: 'sign-in',
        // Lazy: keeps the Supabase client and zod off the landing page's critical path.
        lazy: async () => ({ Component: (await import('@/features/auth/SignInPage')).SignInPage }),
      },
      { path: 'sign-up', element: <PlaceholderPage page="signUp" className={inCard} /> },
      {
        path: 'forgot-password',
        element: <PlaceholderPage page="forgotPassword" className={inCard} />,
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
