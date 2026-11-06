import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { FormLayout } from '@/components/layout/FormLayout';
import { formRoutes, legacyFormRedirects } from '@/features/forms/registry';
import { LandingPage } from '@/features/landing';
import { isAuthEnabled } from '@/lib/features';
import { ComingNextPage } from '@/pages/ComingNextPage';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { AuthOnly } from './AuthOnly';
import { RequireAuth } from './guards/RequireAuth';
import { RequireAuthEnabled } from './guards/RequireAuthEnabled';
import { RequireOnboarding } from './guards/RequireOnboarding';
import { RequireRole } from './guards/RequireRole';

/**
 * Guard nesting (UX only; the database is the authority):
 *   /onboarding → RequireAuth (public AppLayout)
 *   /app, /app/profile → RequireAuth → RequireOnboarding (AppShellLayout)
 *   /app/projects/new, /app/projects/:id/edit → … → RequireOnboarding → RequireRole(allow: 'student')
 *   /admin      → RequireAuth → RequireOnboarding → RequireRole(allow: 'admin') (AppShellLayout)
 * RequireOnboarding redirects to /onboarding and RequireRole to /app, so neither can loop.
 * With VITE_AUTH_ENABLED=false (phase 1 launch mode) RequireAuthEnabled sends all three to
 * /sign-in, which then shows the "Coming soon" page instead of the form.
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
        lazy: async () => ({
          Component: isAuthEnabled()
            ? (await import('@/features/auth/SignInPage')).SignInPage
            : ComingSoonPage,
        }),
      },
      {
        path: 'sign-up',
        lazy: async () => ({
          Component: isAuthEnabled()
            ? (await import('@/features/auth/SignUpPage')).SignUpPage
            : ComingSoonPage,
        }),
      },
      {
        path: 'forgot-password',
        element: (
          <AuthOnly>
            <PlaceholderPage page="forgotPassword" className={inCard} />
          </AuthOnly>
        ),
      },
      // Forms system (SCRUM-34): /forms/<slug>, including request access (SCRUM-14).
      ...formRoutes,
      ...legacyFormRedirects,
      {
        path: 'check-email',
        lazy: async () => ({
          Component: isAuthEnabled()
            ? (await import('@/features/auth/CheckEmailPage')).CheckEmailPage
            : ComingSoonPage,
        }),
      },
      {
        // emailRedirectTo of sign-up and resend. Allowed by additional_redirect_urls.
        path: 'auth/confirmed',
        lazy: async () => ({
          Component: isAuthEnabled()
            ? (await import('@/features/auth/AuthConfirmedPage')).AuthConfirmedPage
            : ComingSoonPage,
        }),
      },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      {
        path: 'privacy',
        lazy: async () => ({
          Component: (await import('@/features/privacy/PrivacyPage')).PrivacyPage,
        }),
      },
      // Short link for campaigns; vercel.json redirects it too (before the SPA loads).
      { path: 'register', element: <Navigate to="/forms/interest" replace /> },
      {
        element: <RequireAuthEnabled />,
        children: [
          {
            element: <RequireAuth />,
            children: [
              {
                path: 'onboarding',
                lazy: async () => ({
                  Component: (await import('@/features/onboarding/OnboardingPage')).OnboardingPage,
                }),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // Signed-in pages: the app shell (SCRUM-16) inside the same guards.
    element: <RequireAuthEnabled />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <RequireOnboarding />,
            children: [
              {
                // Lazy: the shell's account menu pulls in the Supabase client.
                lazy: async () => ({
                  Component: (await import('@/components/layout/AppShellLayout')).AppShellLayout,
                }),
                children: [
                  {
                    path: 'app',
                    lazy: async () => ({
                      Component: (await import('@/features/dashboard/DashboardPage')).DashboardPage,
                    }),
                  },
                  { path: 'app/profile', element: <ComingNextPage page="profile" /> },
                  {
                    // Projects (SCRUM-18): students only. RequireRole sends anyone else to /app.
                    element: <RequireRole allow="student" />,
                    children: [
                      {
                        path: 'app/projects/new',
                        lazy: async () => ({
                          Component: (await import('@/features/projects/NewProjectPage'))
                            .NewProjectPage,
                        }),
                      },
                      {
                        path: 'app/projects/:id/edit',
                        lazy: async () => ({
                          Component: (await import('@/features/projects/EditProjectPage'))
                            .EditProjectPage,
                        }),
                      },
                    ],
                  },
                  {
                    element: <RequireRole allow="admin" />,
                    children: [{ path: 'admin', element: <PlaceholderPage page="admin" /> }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
