import { CircleCheck, LinkIcon, LoaderCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuthCallback } from './api';
import { useAuth } from './auth-context';
import { authLinkClass } from './CheckEmailPage';
import { AuthStatusIcon } from './components/AuthStatusIcon';
import { ResendLink } from './components/ResendLink';

/**
 * /auth/confirmed, the emailRedirectTo target. supabase-js turns the link into a session; this page
 * waits for that, removes tokens, codes and error params from the address bar, then shows the
 * result. Success means a signed-in user with a confirmed email, so a reused link still shows
 * success to that user, and an expired link, a used one or error params show the error state to
 * anyone else. UX only: the email-confirmed trigger set the profile's status in the database.
 */
export function AuthConfirmedPage() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const callback = useAuthCallback();
  const auth = useAuth();

  const done = !callback.isPending;
  const dirtyUrl = search !== '' || hash !== '';
  useEffect(() => {
    if (done && dirtyUrl) void navigate({ pathname, search: '', hash: '' }, { replace: true });
  }, [done, dirtyUrl, navigate, pathname]);

  // The link's session reaches AuthProvider through onAuthStateChange a moment later.
  const waitingForSession = callback.data?.hasSession === true && auth.session === null;
  if (!done || auth.status === 'loading' || waitingForSession) return <Verifying />;

  return auth.session?.user.email_confirmed_at ? <Confirmed /> : <LinkFailed />;
}

function Verifying() {
  const { t } = useTranslation();
  return (
    <div role="status">
      <AuthStatusIcon icon={LoaderCircle} iconClassName="motion-safe:animate-spin" />
      <p className="auth-title font-bold text-brand">{t('auth.confirmed.verifying')}</p>
    </div>
  );
}

/** Focuses the heading that replaces the verifying state, so the result is read once. */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

function Confirmed() {
  const { t } = useTranslation();
  const { role, verificationStatus } = useAuth();
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const verifiedStudent = role === 'student' && verificationStatus === 'verified';

  return (
    <>
      <AuthStatusIcon icon={CircleCheck} />
      <h1 ref={heading} tabIndex={-1} className="auth-title text-brand outline-none">
        {t('auth.confirmed.title')}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {verifiedStudent ? t('auth.confirmed.student') : t('auth.confirmed.reviewed')}
      </p>
      <Button asChild size="lg" className="mt-8 w-full">
        <Link to="/onboarding">{t('auth.confirmed.continue')}</Link>
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
        {t('auth.confirmed.failed')}
      </h1>
      <div className="mt-6">
        <ResendLink />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        <Link to="/sign-in" className={authLinkClass}>
          {t('auth.confirmed.signIn')}
        </Link>
      </p>
    </>
  );
}
