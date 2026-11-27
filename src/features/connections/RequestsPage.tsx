import { Inbox, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
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
import { useAuth } from '@/features/auth/auth-context';
import { page } from '@/features/projects/styles';
import { useDirection } from '@/hooks/useDirection';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  REASON_MAX,
  RequestFailure,
  type RequestItem,
  useReceivedRequests,
  useRespondToRequest,
  useSentRequests,
  useWithdrawRequest,
} from './api';
import { LoadError, ListSkeleton, RequestStatusChip } from './components/parts';
import { formatDay } from './format';

/**
 * /app/requests (SCRUM-21): a student's received requests (accept or decline), an organization's
 * sent requests (withdraw while pending). Mentors: coming later (Plan §11 types 5 and 6, D-07).
 */
export function RequestsPage() {
  const { t } = useTranslation();
  const { role, verificationStatus } = useAuth();
  useDocumentTitle(t('connections.requests.metaTitle'));

  let body: React.ReactNode;
  if (role === 'mentor' || role === 'admin') {
    body = <p className="mt-2 text-muted-foreground">{t('connections.requests.mentorBody')}</p>;
  } else if (verificationStatus !== 'verified') {
    body = (
      <p className="mt-2 max-w-2xl text-muted-foreground">
        {t('connections.requests.verifyFirst')}
      </p>
    );
  } else {
    body = role === 'organization' ? <SentList /> : <ReceivedList />;
  }

  return (
    <div className={page}>
      <h1 className="auth-title text-brand">{t('connections.requests.title')}</h1>
      {body}
    </div>
  );
}

function ReceivedList() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const list = useReceivedRequests(session?.user.id);
  return (
    <>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        {t('connections.requests.receivedIntro')}
      </p>
      <div className="mt-6">
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError ? (
          <LoadError retrying={list.isRefetching} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState icon={Inbox} className="max-w-2xl">
            {t('connections.requests.emptyReceived')}
          </EmptyState>
        ) : (
          <ul aria-label={t('connections.requests.receivedLabel')} className="flex flex-col gap-4">
            {list.data.map((item) => (
              <li key={item.id}>
                <RequestCard item={item} side="received" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function SentList() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const list = useSentRequests(session?.user.id);
  return (
    <>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t('connections.requests.sentIntro')}</p>
      <div className="mt-6">
        {list.isPending ? (
          <ListSkeleton />
        ) : list.isError ? (
          <LoadError retrying={list.isRefetching} onRetry={() => void list.refetch()} />
        ) : list.data.length === 0 ? (
          <EmptyState
            icon={Send}
            className="max-w-2xl"
            action={
              <Button asChild variant="outline">
                <Link to="/projects">{t('connections.requests.explore')}</Link>
              </Button>
            }
          >
            {t('connections.requests.emptySent')}
          </EmptyState>
        ) : (
          <ul aria-label={t('connections.requests.sentLabel')} className="flex flex-col gap-4">
            {list.data.map((item) => (
              <li key={item.id}>
                <RequestCard item={item} side="sent" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

type Decision = 'accept' | 'decline';

function RequestCard({ item, side }: { item: RequestItem; side: 'received' | 'sent' }) {
  const { t } = useTranslation();
  const { language } = useDirection();
  const respond = useRespondToRequest();
  const withdraw = useWithdrawRequest();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const name =
    item.counterpartName ??
    (side === 'received'
      ? t('connections.requests.unknownSender')
      : t('connections.requests.unknownRecipient'));
  const pending = item.status === 'pending';
  const headingId = `request-${item.id}`;

  const confirm = () => {
    if (!decision) return;
    respond.mutate(
      { requestId: item.id, accept: decision === 'accept', reason },
      {
        onSuccess: () => {
          toastStore.show(
            decision === 'accept'
              ? t('connections.requests.accepted')
              : t('connections.requests.declined'),
          );
          setDecision(null);
        },
      },
    );
  };

  const fact = (term: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold text-muted-foreground">{term}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );

  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} dir="auto" className="text-lg font-bold text-brand">
            {name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('connections.requests.sentOn', { date: formatDay(item.createdAt, language) })}
            {pending &&
              ` · ${t('connections.requests.expiresOn', { date: formatDay(item.expiresAt, language) })}`}
          </p>
        </div>
        <RequestStatusChip status={item.status} />
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        {fact(
          t('connections.requests.project'),
          item.projectTitle && item.projectId ? (
            <Link
              to={`/projects/${item.projectId}`}
              dir="auto"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              {item.projectTitle}
            </Link>
          ) : (
            t('connections.requests.projectGone')
          ),
        )}
        {side === 'received' &&
          item.counterpartDescription &&
          fact(
            t('connections.requests.about'),
            <span dir="auto" className="whitespace-pre-line">
              {item.counterpartDescription}
            </span>,
          )}
        {side === 'received' &&
          item.counterpartWebsite &&
          fact(
            t('connections.requests.website'),
            <a
              href={item.counterpartWebsite}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="break-all text-primary underline underline-offset-4"
            >
              {item.counterpartWebsite}
              <span className="sr-only"> {t('legal.opensInNewTab')}</span>
            </a>,
          )}
        {fact(
          t('connections.requests.message'),
          <span dir="auto" className="whitespace-pre-line">
            {item.message}
          </span>,
        )}
        {item.declineReason &&
          fact(
            t('connections.requests.reason'),
            <span dir="auto" className="whitespace-pre-line">
              {item.declineReason}
            </span>,
          )}
      </dl>

      {item.status === 'accepted' && (
        <Button asChild variant="outline" className="self-start">
          <Link to="/app/connections">{t('connections.requests.goToConnections')}</Link>
        </Button>
      )}

      {pending && side === 'received' && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          <Button
            type="button"
            onClick={() => {
              respond.reset();
              setDecision('accept');
            }}
          >
            {t('connections.requests.accept')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              respond.reset();
              setReason('');
              setDecision('decline');
            }}
          >
            {t('connections.requests.decline')}
          </Button>
        </div>
      )}

      {pending && side === 'sent' && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {withdraw.isError && (
            <Callout variant="error" live>
              <p>
                {t(
                  `connections.errors.${withdraw.error instanceof RequestFailure ? withdraw.error.kind : 'unexpected'}`,
                )}
              </p>
            </Callout>
          )}
          <Button
            type="button"
            variant="outline"
            className="self-start"
            loading={withdraw.isPending}
            loadingText={t('connections.panel.withdrawing')}
            onClick={() => {
              withdraw.mutate(item.id, {
                onSuccess: () => {
                  toastStore.show(t('connections.panel.withdrawn'));
                },
              });
            }}
          >
            {t('connections.panel.withdraw')}
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
            <DialogTitle>{t(`connections.requests.${decision}Dialog.title`, { name })}</DialogTitle>
            <DialogDescription>
              {t(`connections.requests.${decision}Dialog.body`)}
            </DialogDescription>
            {decision === 'decline' && (
              <TextareaField
                label={t('connections.requests.declineDialog.reasonLabel')}
                rows={3}
                maxLength={REASON_MAX}
                value={reason}
                details={<CharacterCount value={reason.length} max={REASON_MAX} />}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
              />
            )}
            {respond.isError && (
              <Callout variant="error" live>
                <p>
                  {t(
                    `connections.errors.${respond.error instanceof RequestFailure ? respond.error.kind : 'unexpected'}`,
                  )}
                </p>
              </Callout>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={respond.isPending}>
                  {t('connections.requests.cancel')}
                </Button>
              </DialogClose>
              <Button
                type="button"
                loading={respond.isPending}
                loadingText={t('connections.requests.working')}
                onClick={confirm}
              >
                {t(`connections.requests.${decision}Dialog.confirm`)}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </article>
  );
}
