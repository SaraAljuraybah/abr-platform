import { Navigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { useAuth } from '@/features/auth/auth-context';
import { useDirection } from '@/hooks/useDirection';
import { LoadingScreen } from '@/routes/guards/LoadingScreen';
import { useOnboardingData } from './api';
import { StudentOnboarding } from './components/StudentOnboarding';

/**
 * /onboarding (inside RequireAuth). UX only: column grants, RLS and the completion trigger are the
 * authority. An onboarded user goes to /app; students get the four steps; organizations and
 * mentors see that their setup comes next.
 */
export function OnboardingPage() {
  const { t } = useTranslation();
  const { session, role, onboarded } = useAuth();

  if (onboarded) return <Navigate to="/app" replace />;

  return (
    <section className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="auth-title text-brand">{t('onboarding.title')}</h1>
      {role === 'student' && session ? (
        <>
          <p className="mt-2 mb-8 text-muted-foreground">{t('onboarding.intro')}</p>
          <StudentData userId={session.user.id} />
        </>
      ) : (
        <p className="mt-4 text-muted-foreground">{t('onboarding.comingNext')}</p>
      )}
    </section>
  );
}

function StudentData({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { language } = useDirection();
  const query = useOnboardingData(userId, language);

  if (query.isPending) return <LoadingScreen />;
  if (query.isError) {
    return (
      <Callout variant="error" live>
        <p>{t('onboarding.errors.load')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void query.refetch()}
        >
          {t('onboarding.retry')}
        </Button>
      </Callout>
    );
  }
  return <StudentOnboarding userId={userId} data={query.data} />;
}
