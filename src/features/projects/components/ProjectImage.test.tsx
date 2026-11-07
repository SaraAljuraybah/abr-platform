import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { MAX_UPSCALE, ProjectImage } from './ProjectImage';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const project = { title: 'Campus Navigator', track: 'mobile', imagePath: 'p/image-1.png' };

function show(size: 'sm' | 'lg' | 'card' = 'lg') {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <main>
        <ProjectImage project={project} size={size} src="blob:local-image" />
      </main>
    </QueryClientProvider>,
  );
  const foreground = screen.getByTestId('project-image-foreground');
  const backdrop = screen.getByTestId('project-image-backdrop');
  const frame = screen.getByTestId('project-image-frame');
  return { foreground, backdrop, frame };
}

/** jsdom never decodes images: give the <img> a natural size and fire its load event. */
function loaded(img: HTMLElement, width: number, height: number) {
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(img);
}

afterEach(async () => {
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('project image fills its frame (%s)', (language) => {
  const t = copy[language];

  it.each([
    ['wide', 1600, 400],
    ['tall', 400, 1600],
    ['square', 800, 800],
  ] as const)(
    'a %s image: blurred cover backdrop, whole image in front, never cropped',
    async (_case, width, height) => {
      await changeLanguage(language);
      const { foreground, backdrop, frame } = show();
      loaded(foreground, width, height);

      // Front: the image itself, whole, as large as the frame, no padding.
      expect(foreground).toHaveClass('object-contain', 'size-full');
      expect(foreground).not.toHaveClass('object-cover');
      expect(foreground).toHaveAccessibleName(
        t.projects.media.imageAlt.replace('{{title}}', project.title),
      );
      expect(frame.className).not.toMatch(/(^|\s)p-\d/);
      expect(frame).toHaveClass('overflow-hidden', 'relative', 'isolate');

      // Back: the same picture, cover, blurred, enlarged, dimmed, decorative, behind the image.
      expect(backdrop).toHaveAttribute('src', foreground.getAttribute('src'));
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
      expect(backdrop).toHaveAttribute('alt', '');
      expect(backdrop).toHaveClass(
        'object-cover',
        'blur-[24px]',
        'scale-115',
        'brightness-90',
        'absolute',
        'inset-0',
        '-z-10',
      );
      // Left out when the system asks for more contrast or less transparency.
      expect(backdrop).toHaveClass(
        'contrast-more:hidden',
        '[@media(prefers-reduced-transparency:reduce)]:hidden',
      );
      // Only the front image is announced.
      expect(screen.getAllByRole('img')).toEqual([foreground]);

      // Upscaling stops at twice the natural size.
      expect(foreground).toHaveStyle({
        maxWidth: `${String(width * MAX_UPSCALE)}px`,
        maxHeight: `${String(height * MAX_UPSCALE)}px`,
      });
    },
  );

  it('before the image has loaded there is no size cap yet', async () => {
    await changeLanguage(language);
    const { foreground } = show('card');
    expect(foreground.getAttribute('style')).toBeNull();
  });

  it('the generated default is unchanged (gradient, letter, no layers)', async () => {
    await changeLanguage(language);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProjectImage project={{ ...project, imagePath: null }} size="lg" />
      </QueryClientProvider>,
    );
    const fallback = screen.getByTestId('project-image-default');
    expect(fallback).toHaveAttribute('aria-hidden', 'true');
    expect(fallback).toHaveTextContent('C');
    expect(screen.queryByTestId('project-image-backdrop')).toBeNull();
  });

  it(
    'has no axe violations',
    async () => {
      await changeLanguage(language);
      const { foreground } = show();
      loaded(foreground, 1600, 400);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
