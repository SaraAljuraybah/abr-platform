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
  sm: { box: 'size-12 rounded-md', icon: 'size-4', letter: 'text-lg' },
  lg: { box: 'size-40 rounded-lg', icon: 'size-6', letter: 'text-5xl' },
} as const;

interface ProjectImageProps {
  project: { title: string; track: string | null; imagePath: string | null };
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * The project's uploaded image (through a short-lived signed URL), or the branded default: the deep
 * brand gradient, the track's icon and the title's first letter. Generated, never a stored file.
 * Shown next to the title, so the default is decorative; an uploaded image is named after it.
 */
export function ProjectImage({ project, size = 'sm', className }: ProjectImageProps) {
  const { t } = useTranslation();
  const url = useSignedUrl('image', project.imagePath);
  const s = SIZES[size];

  if (project.imagePath && url.data) {
    return (
      <img
        src={url.data}
        alt={t('projects.media.imageAlt', { title: project.title })}
        className={cn(s.box, 'shrink-0 border border-border bg-muted object-cover', className)}
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
