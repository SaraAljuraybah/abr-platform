import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/auth-context';
import { changeLanguage } from '@/lib/i18n';
import { routes } from '@/routes/routes';

const signedOut: AuthState = { status: 'ready', session: null, role: null, onboarded: false };

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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

  it('renders the logo, skip link and primary navigation in the header', async () => {
    renderAt('/');
    const header = await screen.findByRole('banner');
    expect(within(header).getByRole('img', { name: 'ABR' })).toHaveAttribute(
      'src',
      '/brand/abr-logo.svg',
    );
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
    expect(within(header).getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('renders the footer with logo, language switch and copyright', async () => {
    renderAt('/');
    const footer = await screen.findByRole('contentinfo');
    expect(within(footer).getByRole('img', { name: 'ABR' })).toBeInTheDocument();
    expect(
      within(footer).getByRole('button', { name: /Change language to Arabic/ }),
    ).toBeInTheDocument();
    expect(within(footer).getByText('© 2026 ABR')).toBeInTheDocument();
  });

  it('shows section links on "/" only; other routes get the compact header and footer', async () => {
    renderAt('/sign-in');
    const header = await screen.findByRole('banner');
    expect(within(header).queryByRole('link', { name: 'How it works' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('contentinfo')).queryByRole('navigation'),
    ).not.toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Create an account' })).toBeInTheDocument();
  });

  it.each(['/', '/sign-in'])(
    'shows the build notice in a labelled bar above the header on %s',
    async (path) => {
      renderAt(path);
      const header = await screen.findByRole('banner');
      const bar = screen.getByRole('complementary', { name: 'Build status' });
      expect(bar).toHaveTextContent('Internal build. Only the platform foundation is available.');
      expect(bar.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(screen.getByRole('main')).queryByText(/Internal build/)).toBeNull();
    },
  );

  it('switches to Arabic (RTL) and back to English (LTR)', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const header = await screen.findByRole('banner');

    await user.click(within(header).getByRole('button', { name: /Change language to Arabic/ }));
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'مشاريع التخرج تستحق حياة بعد التخرج.',
    );

    await user.click(within(header).getByRole('button', { name: /تغيير اللغة إلى الإنجليزية/ }));
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });
});
