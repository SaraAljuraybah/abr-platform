import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusChip } from '@/components/ui/status-chip';
import { useAuth } from '@/features/auth/auth-context';
import { useOwnProjects } from '@/features/projects/api';
import { useDirection } from '@/hooks/useDirection';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { firstName, useStudentDashboard } from './api';
import { Card, ProfileCard, ProjectsCard, ProjectsError, WhatsNextCard } from './components/cards';
import { useNextStep } from './next-step';

const page = 'mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-6 sm:py-12';

/**
 * /app (inside RequireAuth and RequireOnboarding). Students get their dashboard; organizations and
 * mentors a "coming next" card with their status; admins keep a placeholder. UX only.
 */
export function DashboardPage() {
  const { t } = useTranslation();
  const { session, role, verificationStatus } = useAuth();

  if (role === 'admin') return <PlaceholderPage page="app" />;

  if (role === 'student' && session) return <StudentDashboardView userId={session.user.id} />;

  return (
    <div className={page}>
      <h1 className="auth-title text-brand">{t('dashboard.title')}</h1>
      <Card id="coming-next" title={t('dashboard.other.title')} className="mt-8 max-w-2xl">
        <div className="flex flex-col items-start gap-3">
          {verificationStatus && <StatusChip status={verificationStatus} />}
          <p className="text-muted-foreground">{t('dashboard.other.body')}</p>
        </div>
      </Card>
    </div>
  );
}

function StudentDashboardView({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { language } = useDirection();
  const query = useStudentDashboard(userId, language);
  // One cached query behind both: "What's next" and "Your projects".
  const next = useNextStep(userId);
  const projects = useOwnProjects(userId);

  if (query.isPending || projects.isPending) return <DashboardSkeleton />;

  if (query.isError) {
    return (
      <div className={page}>
        <h1 className="auth-title text-brand">{t('dashboard.title')}</h1>
        <Callout variant="error" live className="mt-8 max-w-2xl">
          <p>{t('dashboard.error')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            loading={query.isRefetching}
            loadingText={t('dashboard.retrying')}
            onClick={() => void query.refetch()}
          >
            {t('dashboard.retry')}
          </Button>
        </Callout>
      </div>
    );
  }

  const name = firstName(query.data.fullName);
  return (
    <div className={page}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="auth-title text-brand">
          {name ? t('dashboard.welcome', { firstName: name }) : t('dashboard.welcomeNoName')}
        </h1>
        <StatusChip status={query.data.verificationStatus} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          {projects.isError || !next.data ? (
            <ProjectsError
              retrying={projects.isRefetching}
              onRetry={() => void projects.refetch()}
            />
          ) : (
            <>
              <WhatsNextCard step={next.data} />
              <ProjectsCard projects={projects.data} />
            </>
          )}
        </div>
        <ProfileCard profile={query.data} />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div className={page}>
      <h1 className="sr-only">{t('dashboard.title')}</h1>
      <p role="status" className="sr-only">
        {t('dashboard.loading')}
      </p>
      <Skeleton className="h-9 w-64" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
