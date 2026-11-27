import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button-variants';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { StatusChip } from '@/components/ui/status-chip';
import { toastStore } from '@/components/ui/toast-store';
import { useAuth } from '@/features/auth/auth-context';
import { ownProfileKey, useOwnProfile } from '@/features/auth/profile-api';
import { supabase } from '@/lib/supabase';
import { firstName } from './api';
import { Card } from './components/cards';

const page = 'mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-6 sm:py-12';

/** The latest verification decision about the signed-in user (RLS: own rows only). */
function useLatestReview(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['verification-review', 'latest', userId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verification_reviews')
        .select('decision, reason, created_at')
        .eq('subject_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

/** resubmit_verification(): rejected → pending. The server checks the status, not this button. */
function useResubmit(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('resubmit_verification');
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownProfileKey(userId) }),
  });
}

/**
 * /app for organizations and mentors (SCRUM-17): where their verification stands and what to do
 * next. Verified partners go to Explore; rejected ones see the reason, edit, and resubmit.
 */
export function PartnerDashboard({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { verificationStatus } = useAuth();
  const fullName = useOwnProfile(userId).data?.fullName ?? null;
  const rejected = verificationStatus === 'rejected';
  const review = useLatestReview(userId, rejected);
  const resubmit = useResubmit(userId);
  const name = firstName(fullName);
  const status = verificationStatus ?? 'pending';
  const link = buttonVariants({ variant: 'outline' });

  return (
    <div className={page}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="auth-title text-brand">
          {name ? t('dashboard.welcome', { firstName: name }) : t('dashboard.welcomeNoName')}
        </h1>
        <StatusChip status={status} />
      </div>

      <Card
        id="verification"
        title={t(`dashboard.partner.${status}.title`)}
        className="mt-8 max-w-2xl"
      >
        <div className="flex flex-col items-start gap-4">
          <p className="text-muted-foreground">{t(`dashboard.partner.${status}.body`)}</p>

          {rejected && review.data?.reason && (
            <Callout variant="info" className="w-full">
              <p className="font-semibold">{t('dashboard.partner.reasonLabel')}</p>
              {/* Admin-written text: rendered as text, never as HTML. */}
              <p className="mt-1 whitespace-pre-line">{review.data.reason}</p>
            </Callout>
          )}

          {resubmit.isError && (
            <Callout variant="error" live className="w-full">
              <p>{t('dashboard.partner.resubmitError')}</p>
            </Callout>
          )}

          <div className="flex flex-wrap gap-3">
            {status === 'verified' && (
              <Link to="/projects" className={buttonVariants()}>
                {t('dashboard.partner.explore')}
              </Link>
            )}
            {status !== 'suspended' && (
              <Link to="/app/profile" className={link}>
                {t('dashboard.partner.editProfile')}
              </Link>
            )}
            {rejected && (
              <Button
                type="button"
                loading={resubmit.isPending}
                loadingText={t('dashboard.partner.resubmitting')}
                onClick={() => {
                  resubmit.mutate(undefined, {
                    onSuccess: () => {
                      toastStore.show(t('dashboard.partner.resubmitted'));
                    },
                  });
                }}
              >
                {t('dashboard.partner.resubmit')}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
