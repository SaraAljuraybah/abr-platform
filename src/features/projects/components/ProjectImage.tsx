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
  sm: { box: 'size-12 rounded-md', pad: 'p-0.5', icon: 'size-4', letter: 'text-lg' },
  lg: { box: 'size-40 rounded-lg', pad: 'p-2', icon: 'size-6', letter: 'text-5xl' },
} as const;

interface ProjectImageProps {
  project: { title: string; track: string | null; imagePath: string | null };
  size?: keyof typeof SIZES;
  className?: string;
  /** A local image to show instead of the stored one: the re-encoded file in the upload preview. */
  src?: string;
}

/**
 * The project's uploaded image (through a short-lived signed URL), or the branded default: the deep
 * brand gradient, the track's icon and the title's first letter. Generated, never a stored file.
 * Shown next to the title, so the default is decorative; an uploaded image is named after it.
 *
 * An uploaded image is never cropped: it is fitted whole inside the frame (object-contain), centred
 * with a little padding on the neutral surface (#F3EDFF), so wide logos and tall posters stay fully
 * visible. Only max-width/max-height bound it, so a small image is centred at its own size, never
 * scaled up (no blur). The generated default still fills the frame.
 */
export function ProjectImage({ project, size = 'sm', className, src }: ProjectImageProps) {
  const { t } = useTranslation();
  const url = useSignedUrl('image', src ? null : project.imagePath);
  const s = SIZES[size];
  const shown = src ?? (project.imagePath ? url.data : undefined);

  if (shown) {
    return (
      <div
        data-testid="project-image-frame"
        className={cn(
          s.box,
          s.pad,
          'flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted',
          className,
        )}
      >
        <img
          src={shown}
          alt={t('projects.media.imageAlt', { title: project.title })}
          className="block max-h-full max-w-full object-contain"
        />
      </div>
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
