import type { RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { HomePage } from '@/pages/HomePage';
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
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'sign-in', element: <PlaceholderPage page="signIn" /> },
      { path: 'sign-up', element: <PlaceholderPage page="signUp" /> },
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
