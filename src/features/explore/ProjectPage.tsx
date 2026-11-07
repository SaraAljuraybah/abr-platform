import { ArrowLeft, ArrowRight, SearchX, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useParams } from 'react-router';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAuth } from '@/features/auth/auth-context';
import { ProjectDetails } from '@/features/projects/components/ProjectDetails';
import { ProjectLoadError, ProjectSkeleton } from '@/features/projects/components/states';
import { page, panel } from '@/features/projects/styles';
import { useDirection } from '@/hooks/useDirection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/utils';
import { type DirectoryProject, useDirectoryProject } from './api';
import { VerificationRequired } from './ExplorePage';

/** Back to the directory, with the search and filters the visitor came from. */
function BackLink() {
  const { t } = useTranslation();
  const { direction } = useDirection();
  const location = useLocation();
  const state: unknown = location.state;
  const from =
    typeof state === 'object' &&
    state !== null &&
    'from' in state &&
    typeof state.from === 'string' &&
    state.from.startsWith('/projects')
      ? state.from
      : '/projects';
  const Arrow = direction === 'rtl' ? ArrowRight : ArrowLeft;
  return (
    <Link
      to={from}
      className="inline-flex items-center gap-1 self-start rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline"
    >
      <Arrow aria-hidden="true" strokeWidth={1.75} className="size-4" />
      {t('explore.project.back')}
    </Link>
  );
}

function OwnerCard({ project }: { project: DirectoryProject }) {
  const { t } = useTranslation();
  const field =
    project.major === 'other'
      ? project.majorOther
      : project.major
        ? t(`forms.interest.options.field_of_study.${project.major}` as never)
        : null;
  const name = project.ownerName ?? t('explore.card.unknownOwner');
  return (
    <section aria-labelledby="owner-title" className={cn(panel, 'flex flex-col gap-4')}>
      <h2 id="owner-title" className="text-lg font-bold text-brand">
        {t('explore.project.ownerTitle')}
      </h2>
      <div className="flex items-center gap-3">
        <Avatar name={project.ownerName} className="size-10 text-sm" />
        <p dir="auto" className="font-semibold text-foreground">
          {name}
        </p>
      </div>
      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('explore.project.university')}</dt>
          <dd dir="auto" className="text-foreground">
            {project.universityName ?? '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('explore.project.fieldOfStudy')}</dt>
          <dd dir="auto" className="text-foreground">
            {field ?? '—'}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/** Where "Request to connect" arrives in the next story. */
function ConnectPlaceholder() {
  const { t } = useTranslation();
  return (
    <section
      aria-labelledby="connect-title"
      className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-6"
    >
      <h2 id="connect-title" className="flex items-center gap-2 text-lg font-bold text-brand">
        <UserRound aria-hidden="true" strokeWidth={1.75} className="size-5" />
        {t('explore.project.connectTitle')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('explore.project.connectBody')}</p>
    </section>
  );
}

/** The same answer for a missing, unpublished or hidden project: nothing leaks. */
function NotFound() {
  const { t } = useTranslation();
  return (
    <div className={page}>
      <h1 className="auth-title text-brand">{t('projects.notFound.title')}</h1>
      <EmptyState
        icon={SearchX}
        className="mt-8 max-w-2xl"
        action={
          <Button asChild variant="outline">
            <Link to="/projects">{t('explore.project.back')}</Link>
          </Button>
        }
      >
        {t('projects.notFound.body')}
      </EmptyState>
    </div>
  );
}

/** /projects/:id (SCRUM-20): one published project and its student, for a verified viewer. */
export function ProjectPage() {
  const { t } = useTranslation();
  const { verificationStatus } = useAuth();
  const { language } = useDirection();
  const { id = '' } = useParams();
  const verified = verificationStatus === 'verified';
  const project = useDirectoryProject(id, language, verified);
  useDocumentTitle(
    project.data
      ? t('explore.project.metaTitle', { title: project.data.title })
      : t('explore.metaTitle'),
  );

  if (!verified) return <VerificationRequired title={t('explore.title')} />;
  if (project.isPending) return <ProjectSkeleton title={t('explore.title')} />;
  if (project.isError) {
    return (
      <ProjectLoadError
        title={t('explore.title')}
        retrying={project.isRefetching}
        onRetry={() => void project.refetch()}
      />
    );
  }
  if (!project.data) return <NotFound />;

  const p = project.data;
  return (
    <div className={cn(page, 'flex flex-col gap-6')}>
      <BackLink />
      <h1 dir="auto" className="auth-title break-words text-brand">
        {p.title}
      </h1>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ProjectDetails project={p} className="max-w-none" />
        <div className="flex flex-col gap-6">
          <OwnerCard project={p} />
          <ConnectPlaceholder />
        </div>
      </div>
    </div>
  );
}
