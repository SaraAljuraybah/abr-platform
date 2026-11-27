import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { useAuth } from '@/features/auth/auth-context';
import { ComingNextPage } from '@/pages/ComingNextPage';
import { LoadingScreen } from '@/routes/guards/LoadingScreen';
import { PartnerOnboarding } from './components/PartnerOnboarding';
import { type PartnerRole, usePartnerData } from './partner';

/**
 * /app/profile (inside RequireAuth and RequireOnboarding). Organizations and mentors edit the
 * profile they submitted for verification; the student profile editor is a later story.
 */
export function ProfilePage() {
  const { session, role } = useAuth();
  if ((role === 'organization' || role === 'mentor') && session) {
    return <PartnerProfile userId={session.user.id} role={role} />;
  }
  return <ComingNextPage page="profile" />;
}

function PartnerProfile({ userId, role }: { userId: string; role: PartnerRole }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = usePartnerData(userId, role);

  return (
    <section className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-6 sm:py-12">
      <Link
        to="/app"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t('comingNext.backToDashboard')}
      </Link>
      <h1 className="auth-title mt-4 text-brand">{t('onboarding.partner.editTitle')}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t('onboarding.partner.editIntro')}</p>
      {query.isPending ? (
        <LoadingScreen />
      ) : query.isError ? (
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
      ) : (
        <PartnerOnboarding
          userId={userId}
          role={role}
          values={query.data}
          mode="edit"
          onSaved={() => void navigate('/app')}
        />
      )}
    </section>
  );
}
