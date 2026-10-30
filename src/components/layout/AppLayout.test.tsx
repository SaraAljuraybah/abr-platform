import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { changeLanguage } from '@/lib/i18n';
import { renderRoute } from '@/test/render-route';

function renderAt(path: string) {
  renderRoute(path);
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
      '/brand/abr-logo.png',
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
    renderAt('/does-not-exist');
    const header = await screen.findByRole('banner');
    expect(within(header).queryByRole('link', { name: 'How it works' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('contentinfo')).queryByRole('navigation'),
    ).not.toBeInTheDocument();
    expect(within(header).getByRole('link', { name: 'Create an account' })).toBeInTheDocument();
  });

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
