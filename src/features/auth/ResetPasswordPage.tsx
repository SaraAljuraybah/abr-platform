import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, KeyRound, LinkIcon, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { PasswordField } from '@/components/ui/password-field';
import { z } from '@/lib/zod-i18n';
import { useAuthCallback, useUpdatePassword } from './api';
import { useAuth } from './auth-context';
import { authLinkClass } from './CheckEmailPage';
import { AuthStatusIcon } from './components/AuthStatusIcon';
import { PasswordChecklist } from './components/PasswordChecklist';
import { ResendLink } from './components/ResendLink';
import { meetsPasswordRules } from './schemas';

/** The sign-up rules (mirrors supabase/config.toml), plus a confirmation that must match. */
const resetSchema = z
  .object({
    password: z.string().min(1).refine(meetsPasswordRules),
    confirm: z.string().min(1),
  })
  .superRefine((values, ctx) => {
    if (values.confirm !== '' && values.confirm !== values.password) {
      ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'mismatch' });
    }
  });
type ResetValues = z.infer<typeof resetSchema>;

/** Focuses the heading that replaces the verifying state, so the result is read once. */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

/**
 * /reset-password (SCRUM-13, page 4), the redirectTo of reset links. supabase-js turns the link into
 * a session; this page waits for it, removes the tokens from the address bar, then asks for the new
 * password. Without a session (an expired or used link, or a direct visit) it offers a new link.
 * After the change it signs out, so the next step is signing in with the new password.
 */
export function ResetPasswordPage() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const callback = useAuthCallback();
  const auth = useAuth();
  const [changed, setChanged] = useState(false);

  const done = !callback.isPending;
  const dirtyUrl = search !== '' || hash !== '';
  useEffect(() => {
    if (done && dirtyUrl) void navigate({ pathname, search: '', hash: '' }, { replace: true });
  }, [done, dirtyUrl, navigate, pathname]);

  if (changed) return <Changed />;
  // The link's session reaches AuthProvider through onAuthStateChange a moment later.
  const waitingForSession = callback.data?.hasSession === true && auth.session === null;
  if (!done || auth.status === 'loading' || waitingForSession) return <Verifying />;
  return auth.session ? (
    <NewPasswordForm
      onChanged={() => {
        setChanged(true);
      }}
    />
  ) : (
    <LinkFailed />
  );
}

function Verifying() {
  const { t } = useTranslation();
  return (
    <div role="status">
      <AuthStatusIcon icon={LoaderCircle} iconClassName="motion-safe:animate-spin" />
      <p className="auth-title font-bold text-brand">{t('auth.reset.checking')}</p>
    </div>
  );
}

function NewPasswordForm({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const update = useUpdatePassword();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const errorRef = useRef<HTMLDivElement>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const password = useWatch({ control, name: 'password' });

  useEffect(() => {
    if (update.error) errorRef.current?.focus();
  }, [update.error]);

  const passwordError = () => {
    const message = errors.password?.message;
    if (!message) return undefined;
    return message === 'validation.required'
      ? t('validation.required')
      : t('auth.signUp.passwordNotMet');
  };
  const confirmError = () => {
    const message = errors.confirm?.message;
    if (!message) return undefined;
    return message === 'mismatch' ? t('auth.reset.mismatch') : t('validation.required');
  };

  return (
    <>
      <AuthStatusIcon icon={KeyRound} />
      <h1 ref={heading} tabIndex={-1} className="auth-title text-brand outline-none">
        {t('auth.reset.title')}
      </h1>
      <form
        noValidate
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) =>
          void handleSubmit((values) => {
            update.mutate({ password: values.password }, { onSuccess: onChanged });
          })(event)
        }
      >
        {update.error && (
          <Callout ref={errorRef} tabIndex={-1} variant="error">
            <p>{t(`auth.errors.${update.error.kind}`)}</p>
          </Callout>
        )}
        <PasswordField
          label={t('auth.reset.password')}
          autoComplete="new-password"
          error={passwordError()}
          details={<PasswordChecklist value={password} />}
          {...register('password')}
        />
        <PasswordField
          label={t('auth.reset.confirm')}
          autoComplete="new-password"
          error={confirmError()}
          {...register('confirm')}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={update.isPending}
          loadingText={t('auth.reset.saving')}
        >
          {t('auth.reset.submit')}
        </Button>
      </form>
      {update.error?.kind === 'resetLinkInvalid' && (
        <p className="mt-6 text-sm text-muted-foreground">
          <Link to="/forgot-password" className={authLinkClass}>
            {t('auth.reset.requestNew')}
          </Link>
        </p>
      )}
    </>
  );
}

function Changed() {
  const { t } = useTranslation();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <>
      <AuthStatusIcon icon={CircleCheck} />
      <h1 ref={heading} tabIndex={-1} className="auth-title text-brand outline-none">
        {t('auth.reset.doneTitle')}
      </h1>
      <p className="mt-3 text-muted-foreground">{t('auth.reset.doneBody')}</p>
      <Button asChild size="lg" className="mt-8 w-full">
        <Link to="/sign-in">{t('auth.reset.signIn')}</Link>
      </Button>
    </>
  );
}

function LinkFailed() {
  const { t } = useTranslation();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  return (
    <>
      <AuthStatusIcon icon={LinkIcon} className="bg-error-bg text-error" />
      <h1 ref={heading} tabIndex={-1} className="auth-title text-brand outline-none">
        {t('auth.reset.failedTitle')}
      </h1>
      <p className="mt-3 text-muted-foreground">{t('auth.reset.failedBody')}</p>
      <div className="mt-6">
        <ResendLink purpose="recovery" />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        <Link to="/sign-in" className={authLinkClass}>
          {t('auth.forgot.backToSignIn')}
        </Link>
      </p>
    </>
  );
}
