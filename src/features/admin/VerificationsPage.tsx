import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { CharacterCount } from '@/components/ui/field-number';
import { TextareaField } from '@/components/ui/textarea-field';
import { toastStore } from '@/components/ui/toast-store';
import { formatLegalDate } from '@/features/legal/format';
import { useDirection } from '@/hooks/useDirection';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Database } from '@/types/database';
import { AdminLoadError, AdminLoading } from './components/states';

type QueueRow = Database['public']['Functions']['admin_verification_queue']['Returns'][number];
const FILTERS = ['pending', 'rejected', 'verified'] as const;
type Filter = (typeof FILTERS)[number];
const isFilter = (value: string | null): value is Filter =>
  (FILTERS as readonly (string | null)[]).includes(value);
const REASON_MAX = 1000;

const verificationQueueKey = (status: Filter) => ['admin', 'verifications', status] as const;

/** admin_verification_queue(): admin only (checked again by the database), with the sign-up email. */
function useVerificationQueue(status: Filter) {
  return useQuery({
    queryKey: verificationQueueKey(status),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_verification_queue', { p_status: status });
      if (error) throw error;
      return data;
    },
  });
}

type Decision = 'approved' | 'rejected';
/** review_verification(): approve, or reject with a reason. The database enforces every rule. */
function useVerify() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; decision: Decision; reason: string }) => {
      const { error } = await supabase.rpc('review_verification', {
        p_subject_id: input.id,
        p_decision: input.decision,
        p_reason: input.reason.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] }),
  });
}

/** /admin/verifications: organizations and mentors waiting for review, oldest first (SCRUM-17). */
export function VerificationsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const raw = params.get('status');
  const status: Filter = isFilter(raw) ? raw : 'pending';
  const queue = useVerificationQueue(status);

  return (
    <>
      <h1 className="auth-title text-brand">{t('admin.verifications.title')}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t('admin.verifications.intro')}</p>
      <nav aria-label={t('admin.verifications.filterLabel')} className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const current = filter === status;
            return (
              <li key={filter}>
                <Link
                  to={
                    filter === 'pending'
                      ? '/admin/verifications'
                      : `/admin/verifications?status=${filter}`
                  }
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors',
                    current
                      ? 'border-2 border-primary bg-primary/10 font-semibold text-foreground'
                      : 'border-border bg-card text-foreground hover:border-primary/60',
                  )}
                >
                  {t(`status.${filter}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6">
        {queue.isPending ? (
          <AdminLoading />
        ) : queue.isError ? (
          <AdminLoadError retrying={queue.isRefetching} onRetry={() => void queue.refetch()} />
        ) : queue.data.length === 0 ? (
          <EmptyState icon={UserCheck} className="max-w-2xl">
            {status === 'pending'
              ? t('admin.verifications.emptyPending')
              : t('admin.verifications.empty')}
          </EmptyState>
        ) : (
          <ul aria-label={t(`status.${status}`)} className="flex flex-col gap-4">
            {queue.data.map((row) => (
              <li key={row.id}>
                <VerificationCard row={row} canDecide={status === 'pending'} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function VerificationCard({ row, canDecide }: { row: QueueRow; canDecide: boolean }) {
  const { t } = useTranslation();
  const { language } = useDirection();
  const verify = useVerify();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const org = row.role === 'organization';
  const label = (prefix: string, value: string) => t(`${prefix}.${value}` as never);
  const title = org ? row.organization_name : row.full_name;

  const confirm = () => {
    if (!decision) return;
    if (decision === 'rejected' && reason.trim() === '') {
      setReasonError(true);
      return;
    }
    verify.mutate(
      { id: row.id, decision, reason },
      {
        onSuccess: () => {
          toastStore.show(t(`admin.verifications.done.${decision}`));
          setDecision(null);
        },
      },
    );
  };

  const fact = (term: string, value: React.ReactNode) =>
    value === null || value === '' ? null : (
      <div className="flex flex-col gap-0.5">
        <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
        <dd className="text-foreground">{value}</dd>
      </div>
    );

  return (
    <article
      aria-labelledby={`verification-${row.id}`}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`verification-${row.id}`} className="text-lg font-bold text-brand">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(`admin.verifications.role.${row.role === 'organization' ? 'organization' : 'mentor'}`)}{' '}
          · {formatLegalDate(row.updated_at.slice(0, 10), language)}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        {fact(t('admin.verifications.contact'), row.full_name)}
        {fact(
          t('admin.verifications.email'),
          <span dir="ltr" className="break-all">
            {row.email}
          </span>,
        )}
        {org ? (
          <>
            {fact(
              t('onboarding.partner.organization.sector'),
              row.sector ? label('forms.interest.options.sector', row.sector) : null,
            )}
            {fact(
              t('onboarding.partner.organization.orgSize'),
              row.org_size ? label('forms.interest.options.org_size', row.org_size) : null,
            )}
            {fact(
              t('onboarding.partner.organization.chips'),
              row.support_types
                .map((code) => label('forms.interest.options.looking_for', code))
                .join('، '),
            )}
            {fact(
              t('onboarding.partner.organization.website'),
              row.website ? (
                <a
                  href={row.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  dir="ltr"
                  className="break-all text-primary underline underline-offset-4"
                >
                  {row.website}
                  <span className="sr-only"> {t('legal.opensInNewTab')}</span>
                </a>
              ) : null,
            )}
          </>
        ) : (
          <>
            {fact(t('onboarding.partner.mentor.jobTitle'), row.job_title)}
            {fact(t('onboarding.partner.mentor.company'), row.company)}
            {fact(t('onboarding.partner.mentor.years'), String(row.years_of_experience))}
            {fact(
              t('onboarding.partner.mentor.chips'),
              row.expertise
                .map((code) => label('forms.interest.options.expertise', code))
                .join('، '),
            )}
          </>
        )}
      </dl>
      <dl>
        {fact(
          org
            ? t('onboarding.partner.organization.description')
            : t('onboarding.partner.mentor.description'),
          <span className="whitespace-pre-line">
            {org ? row.description : row.professional_summary}
          </span>,
        )}
      </dl>

      {canDecide && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <Button
            type="button"
            onClick={() => {
              verify.reset();
              setDecision('approved');
            }}
          >
            {t('admin.verifications.approve')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-error"
            onClick={() => {
              verify.reset();
              setReason('');
              setReasonError(false);
              setDecision('rejected');
            }}
          >
            {t('admin.verifications.reject')}
          </Button>
        </div>
      )}

      <Dialog
        open={decision !== null}
        onOpenChange={(next) => {
          if (!next) setDecision(null);
        }}
      >
        {decision && (
          <DialogContent>
            <DialogTitle>
              {t(`admin.verifications.dialog.${decision}.title`, { name: title })}
            </DialogTitle>
            <DialogDescription>
              {t(`admin.verifications.dialog.${decision}.body`)}
            </DialogDescription>
            {decision === 'rejected' && (
              <TextareaField
                label={t('admin.verifications.reason')}
                rows={4}
                maxLength={REASON_MAX}
                value={reason}
                required
                error={reasonError ? t('admin.verifications.reasonRequired') : undefined}
                details={<CharacterCount value={reason.length} max={REASON_MAX} />}
                onChange={(event) => {
                  setReason(event.target.value);
                  if (reasonError) setReasonError(false);
                }}
              />
            )}
            {verify.isError && (
              <Callout variant="error" live>
                <p>{t('admin.verifications.error')}</p>
              </Callout>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={verify.isPending}>
                  {t('admin.verifications.cancel')}
                </Button>
              </DialogClose>
              <Button
                type="button"
                loading={verify.isPending}
                loadingText={t('admin.verifications.sending')}
                onClick={confirm}
              >
                {t(`admin.verifications.dialog.${decision}.confirm`)}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </article>
  );
}
