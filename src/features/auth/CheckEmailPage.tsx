import { Mail } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { AuthStatusIcon } from './components/AuthStatusIcon';
import { ResendLink } from './components/ResendLink';

export const authLinkClass =
  'rounded-sm font-semibold text-primary underline-offset-4 hover:underline';

/** The address sign-up passed in router state. Never read from the URL (no addresses in logs). */
function emailFromState(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('email' in state)) return null;
  const { email } = state;
  return typeof email === 'string' && email.trim() !== '' ? email.trim() : null;
}

/**
 * /check-email, after sign-up. On a refresh or a direct visit the state is gone: the generic
 * version shows, without an address and without the resend button.
 */
export function CheckEmailPage() {
  const { t } = useTranslation();
  const email = emailFromState(useLocation().state);

  return (
    <>
      <AuthStatusIcon icon={Mail} />
      <h1 className="auth-title text-brand">{t('auth.checkEmail.title')}</h1>
      <p className="mt-3 text-muted-foreground">
        {email ? (
          <Trans
            i18nKey="auth.checkEmail.bodyWithEmail"
            values={{ email }}
            components={{ email: <strong dir="ltr" className="font-semibold text-foreground" /> }}
          />
        ) : (
          t('auth.checkEmail.body')
        )}
      </p>

      {email && (
        <>
          <p className="mt-3 text-sm text-muted-foreground">{t('auth.checkEmail.tip')}</p>
          <div className="mt-6">
            <ResendLink email={email} />
          </div>
        </>
      )}

      <div className="mt-8 flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          {t('auth.checkEmail.wrongEmail')}{' '}
          <Link to="/sign-up" className={authLinkClass}>
            {t('auth.checkEmail.signUpAgain')}
          </Link>
        </p>
        <p>
          {t('auth.checkEmail.alreadyConfirmed')}{' '}
          <Link to="/sign-in" className={authLinkClass}>
            {t('auth.checkEmail.signIn')}
          </Link>
        </p>
      </div>
    </>
  );
}
