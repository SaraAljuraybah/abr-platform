import {
  Bot,
  Brain,
  ChartColumn,
  Cloud,
  Cpu,
  Gamepad2,
  Globe,
  Lightbulb,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useSignedUrl } from '../api';

const TRACK_ICONS: Record<string, LucideIcon> = {
  ai: Brain,
  web: Globe,
  mobile: Smartphone,
  cyber: ShieldCheck,
  data: ChartColumn,
  iot: Cpu,
  games: Gamepad2,
  cloud: Cloud,
  robotics: Bot,
  other: Lightbulb,
};

const SIZES = {
  sm: { box: 'size-12 rounded-md', icon: 'size-4', letter: 'text-lg' },
  lg: { box: 'size-40 rounded-lg', icon: 'size-6', letter: 'text-5xl' },
  // The directory card (SCRUM-20): fills the card's image area, whatever its shape.
  card: { box: 'size-full', icon: 'size-6', letter: 'text-5xl' },
} as const;

interface ProjectImageProps {
  project: { title: string; track: string | null; imagePath: string | null };
  size?: keyof typeof SIZES;
  className?: string;
  /** A local image to show instead of the stored one: the re-encoded file in the upload preview. */
  src?: string;
  /**
   * The signed URL was fetched by the caller (the directory signs a whole page in one request):
   * no request of its own. `url` undefined while pending or when signing failed.
   */
  signed?: { url: string | undefined; pending: boolean };
  /** Next to a visible title (a card link): the image adds nothing for screen readers. */
  decorative?: boolean;
}

/**
 * The project's uploaded image (through a short-lived signed URL), or the branded default: the deep
 * brand gradient, the track's icon and the title's first letter. Generated, never a stored file.
 * Shown next to the title, so the default is decorative; an uploaded image is named after it.
 *
 * An uploaded image is never cropped, and the frame always looks full (SCRUM-20): behind it, the same
 * image covers the frame, blurred, slightly enlarged and dimmed (decorative, aria-hidden); in front,
 * the image itself is fitted whole (object-contain), with no padding, as large as the frame allows,
 * but never more than twice its natural size, so a small logo is not blown up into a blur. When the
 * system asks for more contrast or less transparency, the blurred layer is left out (plain surface).
 * The generated default fills the frame as before.
 */
export function ProjectImage({
  project,
  size = 'sm',
  className,
  src,
  signed,
  decorative = false,
}: ProjectImageProps) {
  const { t } = useTranslation();
  const url = useSignedUrl('image', src || signed ? null : project.imagePath);
  const s = SIZES[size];
  const shown = src ?? (project.imagePath ? (signed ? signed.url : url.data) : undefined);

  // The page's batch of URLs is still on its way: a quiet frame, not a flash of the default.
  if (!shown && project.imagePath && signed?.pending) {
    return (
      <div
        aria-hidden="true"
        data-testid="project-image-pending"
        className={cn(s.box, 'shrink-0 bg-muted motion-safe:animate-pulse', className)}
      />
    );
  }

  if (shown) {
    return (
      <FilledImage
        src={shown}
        alt={decorative ? '' : t('projects.media.imageAlt', { title: project.title })}
        className={cn(s.box, className)}
      />
    );
  }

  const Icon = TRACK_ICONS[project.track ?? 'other'] ?? Lightbulb;
  // The first user-perceived character (Arabic letters and emoji stay whole).
  const first = new Intl.Segmenter().segment(project.title.trim())[Symbol.iterator]().next();
  const letter = first.done ? '' : first.value.segment.toLocaleUpperCase();
  return (
    <div
      aria-hidden="true"
      data-testid="project-image-default"
      className={cn(
        s.box,
        'relative flex shrink-0 items-center justify-center overflow-hidden text-white',
        className,
      )}
      style={{ backgroundImage: 'var(--abr-gradient-deep)' }}
    >
      <span className={cn('font-bold', s.letter)}>{letter}</span>
      <Icon
        strokeWidth={1.75}
        className={cn('absolute end-1.5 bottom-1.5 opacity-80', s.icon)}
        data-track={project.track ?? 'other'}
      />
    </div>
  );
}

/** Upscaling stops at this multiple of the image's natural size. */
export const MAX_UPSCALE = 2;

function FilledImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [natural, setNatural] = useState<{ src: string; width: number; height: number } | null>(
    null,
  );
  const size = natural?.src === src ? natural : null;
  return (
    <div
      data-testid="project-image-frame"
      className={cn(
        'relative isolate flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted',
        className,
      )}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        data-testid="project-image-backdrop"
        className={cn(
          'pointer-events-none absolute inset-0 -z-10 size-full scale-115 object-cover blur-[24px] brightness-90',
          'contrast-more:hidden [@media(prefers-reduced-transparency:reduce)]:hidden',
        )}
      />
      <img
        src={src}
        alt={alt}
        data-testid="project-image-foreground"
        className="block size-full object-contain"
        style={
          size
            ? { maxWidth: size.width * MAX_UPSCALE, maxHeight: size.height * MAX_UPSCALE }
            : undefined
        }
        onLoad={(event) => {
          const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
          if (width > 0 && height > 0) setNatural({ src, width, height });
        }}
      />
    </div>
  );
}
