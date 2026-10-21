import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/auth-context';
import { changeLanguage } from '@/lib/i18n';
import { routes } from '@/routes/routes';

const signedOut: AuthState = { status: 'ready', session: null, role: null, onboarded: false };

function renderHome() {
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(
    <AuthContext value={signedOut}>
      <RouterProvider router={router} />
    </AuthContext>,
  );
}

describe('AppLayout', () => {
  afterEach(async () => {
    await changeLanguage('en');
  });

  it('renders the logo, skip link and primary navigation', async () => {
    renderHome();
    expect(await screen.findByRole('img', { name: 'ABR' })).toHaveAttribute(
      'src',
      '/brand/abr-logo.png',
    );
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('switches to Arabic (RTL) and back to English (LTR)', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: /Change language to Arabic/ }));
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'مشاريع التخرج تستحق حياة بعد التخرج.',
    );

    await user.click(screen.getByRole('button', { name: /تغيير اللغة إلى الإنجليزية/ }));
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });
});
