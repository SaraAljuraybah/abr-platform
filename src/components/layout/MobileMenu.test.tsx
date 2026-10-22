import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/auth-context';
import { routes } from '@/routes/routes';

const signedOut: AuthState = { status: 'ready', session: null, role: null, onboarded: false };

async function setup() {
  const user = userEvent.setup();
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(
    <AuthContext value={signedOut}>
      <RouterProvider router={router} />
    </AuthContext>,
  );
  const header = await screen.findByRole('banner');
  const button = within(header).getByRole('button', { name: 'Menu' });
  const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
  if (!panel) throw new Error('menu panel not found');
  return { user, button, panel };
}

describe('MobileMenu', () => {
  it('starts closed', async () => {
    const { button, panel } = await setup();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();
  });

  it('opens and shows the section links and account actions', async () => {
    const { user, button, panel } = await setup();
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    for (const name of ['How it works', "Who it's for", 'Trust & privacy', 'FAQ']) {
      expect(within(panel).getByRole('link', { name })).toBeVisible();
    }
    expect(within(panel).getByRole('link', { name: 'Create an account' })).toBeVisible();
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    const { user, button, panel } = await setup();
    await user.click(button);
    await user.tab(); // move focus into the panel
    expect(button).not.toHaveFocus();

    await user.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panel).not.toBeVisible();
    expect(button).toHaveFocus();
  });

  it('closes when a link is chosen', async () => {
    const { user, button, panel } = await setup();
    await user.click(button);
    await user.click(within(panel).getByRole('link', { name: 'FAQ' }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on a click outside', async () => {
    const { user, button } = await setup();
    await user.click(button);
    await user.click(screen.getByRole('heading', { level: 1 }));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });
});
