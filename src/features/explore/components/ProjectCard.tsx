import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ProjectImage } from '@/features/projects/components/ProjectImage';
import { useOptionLabels } from '@/features/projects/components/labels';
import { cn } from '@/lib/utils';
import type { DirectoryCard } from '../api';

interface Chip {
  key: string;
  label: string;
  /** Read instead of `label` (the "+N" sectors chip says "More: N"). */
  srLabel?: string;
  /** How many labels the chip stands for (the "+N" chip stands for N). */
  weight: number;
  plus?: boolean;
}

const chipClass =
  'inline-flex h-6 shrink-0 items-center rounded-full border border-primary/30 bg-primary/10 px-2 text-xs whitespace-nowrap text-foreground';
const GAP_PX = 4; // gap-1

/**
 * Labels in ONE row. Chips that do not fit are folded into a "+M" chip; they stay in the list for
 * screen readers (sr-only), so nothing is lost. Widths come from a hidden mirror row. Without a
 * layout (jsdom, or before the first paint) every chip is shown.
 */
function ChipRow({ chips, label }: { chips: Chip[]; label: string }) {
  const { t } = useTranslation();
  const rowRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(chips.length);
  const signature = chips.map((chip) => chip.label).join('|');

  useLayoutEffect(() => {
    const row = rowRef.current;
    const mirror = mirrorRef.current;
    if (!row || !mirror) return;
    const count = mirror.children.length - 1; // the last child is the "+M" sample
    const measure = () => {
      const available = row.clientWidth;
      const widths = Array.from(mirror.children, (el) => (el as HTMLElement).offsetWidth);
      const plusWidth = widths[count] ?? 0;
      const width = (k: number) =>
        widths.slice(0, k).reduce((sum, w) => sum + w, 0) + GAP_PX * Math.max(0, k - 1);
      if (available === 0 || width(count) <= available) {
        setFit(count);
        return;
      }
      let k = count - 1;
      while (k > 0 && width(k) + GAP_PX + plusWidth > available) k -= 1;
      setFit(k);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => {
      observer.disconnect();
    };
  }, [signature]);

  // When anything overflows, a "+N" chip inside the visible part folds into the overflow too.
  const overflowing = fit < chips.length;
  const visible = new Set(
    chips
      .slice(0, fit)
      .filter((chip) => !(overflowing && chip.plus))
      .map((chip) => chip.key),
  );
  const hiddenWeight = chips
    .filter((chip) => !visible.has(chip.key))
    .reduce((sum, chip) => sum + chip.weight, 0);

  return (
    <div ref={rowRef} className="relative min-w-0 overflow-hidden">
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="invisible absolute start-0 top-0 flex gap-1"
        data-testid="chip-mirror"
      >
        {chips.map((chip) => (
          <span key={chip.key} className={chipClass}>
            {chip.label}
          </span>
        ))}
        <span className={chipClass}>{t('explore.card.more', { count: 9 })}</span>
      </div>
      <ul aria-label={label} className="flex gap-1">
        {chips.map((chip) => (
          <li
            key={chip.key}
            className={visible.has(chip.key) ? chipClass : 'sr-only'}
            data-chip={chip.key}
          >
            {chip.srLabel ? (
              <>
                <span aria-hidden="true">{chip.label}</span>
                <span className="sr-only">{chip.srLabel}</span>
              </>
            ) : (
              chip.label
            )}
          </li>
        ))}
        {hiddenWeight > 0 && (
          <li aria-hidden="true" className={chipClass} data-chip="overflow">
            {t('explore.card.more', { count: hiddenWeight })}
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * A directory card (SCRUM-20). Square from md up: image on top (never cropped), then the title (two
 * lines at most), the owner, the team size and the labels. Below md the text part grows to fit.
 * The title is the card's only link; it covers the whole card (::after), so the card's accessible
 * name is the title and the rest is read as the card's content. The card shows the focus ring.
 */
export function ProjectCard({
  card,
  signed,
  linkState,
}: {
  card: DirectoryCard;
  signed: { url: string | undefined; pending: boolean };
  linkState?: unknown;
}) {
  const { t } = useTranslation();
  const labels = useOptionLabels();

  const extraSectors = card.sectors.length - 2;
  const chips: Chip[] = [
    ...(card.track ? [{ key: 'track', label: labels.track(card.track), weight: 1 }] : []),
    ...(card.stage ? [{ key: 'stage', label: labels.stage(card.stage), weight: 1 }] : []),
    ...card.sectors
      .slice(0, 2)
      .map((code) => ({ key: `sector-${code}`, label: labels.sector(code), weight: 1 })),
    ...(extraSectors > 0
      ? [
          {
            key: 'sectors-more',
            label: t('explore.card.more', { count: extraSectors }),
            srLabel: t('explore.card.moreLabel', { count: extraSectors }),
            weight: extraSectors,
            plus: true,
          },
        ]
      : []),
    ...(card.lookingForMembers
      ? [{ key: 'members', label: t('explore.card.lookingForMembers'), weight: 1 }]
      : []),
  ];

  return (
    <article
      data-testid="project-card"
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition',
        'hover:shadow-md motion-safe:transition-transform motion-safe:hover:-translate-y-0.5',
        'has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring',
        'md:aspect-square',
      )}
    >
      {/* md+: at least 55% of the square, more when the title fits on one line. */}
      <div className="aspect-[2/1] shrink-0 md:aspect-auto md:min-h-[55%] md:flex-1">
        <ProjectImage project={card} size="card" signed={signed} decorative />
      </div>
      <div className="flex shrink-0 flex-col gap-1 p-2.5">
        <h2 dir="auto" className="line-clamp-2 text-sm leading-snug font-bold text-brand">
          <Link
            to={`/projects/${card.id}`}
            state={linkState}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {card.title}
          </Link>
        </h2>
        {/* Owner and team size share one line; the name is cut first. */}
        <p className="flex min-w-0 items-baseline gap-1.5 text-xs">
          <span dir="auto" className="min-w-0 truncate text-foreground">
            {card.ownerName ?? t('explore.card.unknownOwner')}
          </span>
          <span aria-hidden="true" className="text-muted-foreground">
            ·
          </span>
          <span className="shrink-0 text-muted-foreground">
            {t('explore.card.teamSize', { count: card.teamSize })}
          </span>
        </p>
        {chips.length > 0 && <ChipRow chips={chips} label={t('explore.card.labels')} />}
      </div>
    </article>
  );
}

/** A grey card while the first page loads (aria-hidden; the page says "Loading projects…"). */
export function ProjectCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-card md:aspect-square"
    >
      <span className="block aspect-[2/1] bg-muted motion-safe:animate-pulse md:aspect-auto md:min-h-[55%] md:flex-1" />
      <span className="flex flex-col gap-2 p-3">
        <span className="block h-4 w-3/4 rounded bg-muted motion-safe:animate-pulse" />
        <span className="block h-3 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
        <span className="block h-5 w-2/3 rounded-full bg-muted motion-safe:animate-pulse" />
      </span>
    </div>
  );
}
