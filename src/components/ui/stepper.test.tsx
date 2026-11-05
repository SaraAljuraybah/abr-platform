import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { changeLanguage } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { Stepper } from './stepper';

const copy = { en, ar } as const;

afterEach(async () => {
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('Stepper (%s)', (language) => {
  const t = copy[language];
  const names = Object.values(t.onboarding.steps);

  it('numbers the steps, marks the current one and says "step 2 of 4"', async () => {
    await changeLanguage(language);
    render(<Stepper steps={names} current={1} label={t.onboarding.stepperLabel} />);

    const nav = screen.getByRole('navigation', { name: t.onboarding.stepperLabel });
    const items = within(nav).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
      null,
    ]);
    expect(
      within(nav).getByText(
        t.stepper.position.replace('{{current}}', '2').replace('{{total}}', '4'),
      ),
    ).toBeInTheDocument();
    // Done steps say so in text, not by colour alone.
    const [first, , third] = items;
    if (!first || !third) throw new Error('missing steps');
    expect(within(first).getByText(t.stepper.completed)).toBeInTheDocument();
    expect(within(third).queryByText(t.stepper.completed)).toBeNull();
    // Every step is named for screen readers at every width.
    names.forEach((name) => {
      expect(within(nav).getAllByText(name).length).toBeGreaterThan(0);
    });
    expect(await axeViolations()).toEqual([]);
  });
});
