import { Handshake } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CharacterCount } from '@/components/ui/field-number';
import { TextareaField } from '@/components/ui/textarea-field';
import { toastStore } from '@/components/ui/toast-store';
import { useAuth } from '@/features/auth/auth-context';
import { panel } from '@/features/projects/styles';
import { useDirection } from '@/hooks/useDirection';
import { cn } from '@/lib/utils';
import {
  MESSAGE_MAX,
  MESSAGE_MIN,
  RequestFailure,
  useProjectRequest,
  useSendRequest,
  useWithdrawRequest,
} from '../api';
import { formatDay } from '../format';

function Frame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="connect-title" className={cn(panel, 'flex flex-col gap-4')}>
      <h2 id="connect-title" className="flex items-center gap-2 text-lg font-bold text-brand">
        <Handshake aria-hidden="true" strokeWidth={1.75} className="size-5" />
        {t('connections.panel.title')}
      </h2>
      {children}
    </section>
  );
}

function ErrorText({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const kind = error instanceof RequestFailure ? error.kind : 'unexpected';
  return (
    <Callout variant="error" live>
      <p>{t(`connections.errors.${kind}`)}</p>
    </Callout>
  );
}

/**
 * "Request to connect" on /projects/:id (SCRUM-21). Organizations send, follow and withdraw their
 * request here; the project owner and other roles get a short explanation. Every rule is enforced
 * again by send_org_project_request() and withdraw_request(); this only reflects the state.
 */
export function ConnectPanel({ projectId, ownerId }: { projectId: string; ownerId: string }) {
  const { t } = useTranslation();
  const { session, role } = useAuth();
  const userId = session?.user.id;

  if (role === 'organization') return <OrganizationPanel projectId={projectId} userId={userId} />;
  if (role === 'admin') return null;

  let body: React.ReactNode;
  if (role === 'student' && userId === ownerId) {
    body = (
      <>
        <p className="text-sm text-muted-foreground">{t('connections.panel.ownerBody')}</p>
        <Button asChild variant="outline" className="self-start">
          <Link to="/app/requests">{t('connections.panel.ownerLink')}</Link>
        </Button>
      </>
    );
  } else {
    body = (
      <p className="text-sm text-muted-foreground">
        {role === 'mentor' ? t('connections.panel.mentorBody') : t('connections.panel.studentBody')}
      </p>
    );
  }
  return <Frame>{body}</Frame>;
}

function OrganizationPanel({ projectId, userId }: { projectId: string; userId?: string }) {
  const { t } = useTranslation();
  const { language } = useDirection();
  const latest = useProjectRequest(projectId, userId, true);
  const send = useSendRequest();
  const withdraw = useWithdrawRequest();
  const [message, setMessage] = useState('');
  const [tooShort, setTooShort] = useState(false);

  if (latest.isPending) {
    return (
      <Frame>
        <p className="text-sm text-muted-foreground">{t('connections.loading')}</p>
      </Frame>
    );
  }
  if (latest.isError) {
    return (
      <Frame>
        <Callout variant="error" live>
          <p>{t('connections.loadError')}</p>
        </Callout>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          loading={latest.isRefetching}
          loadingText={t('connections.retrying')}
          onClick={() => void latest.refetch()}
        >
          {t('connections.retry')}
        </Button>
      </Frame>
    );
  }

  const request = latest.data;

  if (request?.status === 'accepted') {
    return (
      <Frame>
        <p className="text-sm text-foreground">{t('connections.panel.connectedBody')}</p>
        <Button asChild className="self-start">
          <Link to="/app/connections">{t('connections.panel.viewConnections')}</Link>
        </Button>
      </Frame>
    );
  }

  if (request?.status === 'pending') {
    return (
      <Frame>
        <p className="text-sm text-foreground">
          {t('connections.panel.pendingBody', {
            date: formatDay(request.createdAt, language),
            expires: formatDay(request.expiresAt, language),
          })}
        </p>
        {withdraw.isError && <ErrorText error={withdraw.error} />}
        <Button
          type="button"
          variant="outline"
          className="self-start"
          loading={withdraw.isPending}
          loadingText={t('connections.panel.withdrawing')}
          onClick={() => {
            withdraw.mutate(request.id, {
              onSuccess: () => {
                toastStore.show(t('connections.panel.withdrawn'));
              },
            });
          }}
        >
          {t('connections.panel.withdraw')}
        </Button>
      </Frame>
    );
  }

  if (request?.cooldownUntil) {
    const again = request.cooldownUntil;
    return (
      <Frame>
        <p className="text-sm text-foreground">
          {t('connections.panel.declinedBody', { date: formatDay(again, language) })}
        </p>
        {request.declineReason && (
          <dl className="text-sm">
            <dt className="font-semibold text-muted-foreground">
              {t('connections.panel.declineReason')}
            </dt>
            <dd dir="auto" className="whitespace-pre-line text-foreground">
              {request.declineReason}
            </dd>
          </dl>
        )}
      </Frame>
    );
  }

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (message.trim().length < MESSAGE_MIN) {
      setTooShort(true);
      return;
    }
    send.mutate(
      { projectId, message },
      {
        onSuccess: () => {
          setMessage('');
          toastStore.show(t('connections.panel.sent'));
        },
      },
    );
  };

  return (
    <Frame>
      <p className="text-sm text-muted-foreground">{t('connections.panel.intro')}</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextareaField
          label={t('connections.panel.messageLabel')}
          hint={t('connections.panel.messageHint')}
          rows={5}
          maxLength={MESSAGE_MAX}
          value={message}
          required
          error={tooShort ? t('connections.panel.messageTooShort') : undefined}
          details={<CharacterCount value={message.length} max={MESSAGE_MAX} />}
          onChange={(event) => {
            setMessage(event.target.value);
            if (tooShort) setTooShort(false);
          }}
        />
        {send.isError && <ErrorText error={send.error} />}
        <Button
          type="submit"
          className="self-start"
          loading={send.isPending}
          loadingText={t('connections.panel.sending')}
        >
          {t('connections.panel.send')}
        </Button>
      </form>
    </Frame>
  );
}
