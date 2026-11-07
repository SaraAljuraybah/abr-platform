import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { TextField } from '@/components/ui/text-field';
import { validationMessage, z } from '@/lib/zod-i18n';
import { useRequestPasswordReset } from './api';
import { authLinkClass } from './CheckEmailPage';
import { AuthStatusIcon } from './components/AuthStatusIcon';
import { ResendLink } from './components/ResendLink';
import { signInSchema } from './schemas';

const emailSchema = z.object({ email: signInSchema.shape.email });
type EmailValues = z.infer<typeof emailSchema>;

/**
 * /forgot-password (SCRUM-13, page 4). An email gets a reset link that opens /reset-password.
 * The answer is the same whether or not the address has an account (no enumeration); "send again"
 * uses the same cooldown as the confirmation resend.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const request = useRequestPasswordReset();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } });

  useEffect(() => {
    if (sentTo) heading.current?.focus();
  }, [sentTo]);
  useEffect(() => {
    if (request.error) errorRef.current?.focus();
  }, [request.error]);

  if (sentTo) {
    return (
      <>
        <AuthStatusIcon icon={Mail} />
        <h1 ref={heading} tabIndex={-1} className="auth-title text-brand outline-none">
          {t('auth.forgot.sentTitle')}
        </h1>
        <p className="mt-3 text-muted-foreground">
          <Trans
            i18nKey="auth.forgot.sentBody"
            values={{ email: sentTo }}
            components={{ email: <strong dir="ltr" className="font-semibold text-foreground" /> }}
          />
        </p>
        <div className="mt-6">
          <ResendLink email={sentTo} purpose="recovery" />
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          <Link to="/sign-in" className={authLinkClass}>
            {t('auth.forgot.backToSignIn')}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <AuthStatusIcon icon={KeyRound} />
      <h1 className="auth-title text-brand">{t('auth.forgot.title')}</h1>
      <p className="mt-3 text-muted-foreground">{t('auth.forgot.intro')}</p>
      <form
        noValidate
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) =>
          void handleSubmit(({ email }) => {
            request.mutate(
              { email },
              {
                onSuccess: () => {
                  setSentTo(email.trim());
                },
              },
            );
          })(event)
        }
      >
        {request.error && (
          <Callout ref={errorRef} tabIndex={-1} variant="error">
            <p>{t(`auth.errors.${request.error.kind}`)}</p>
          </Callout>
        )}
        <TextField
          label={t('auth.signIn.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          dir="ltr"
          error={validationMessage(t, errors.email?.message)}
          {...register('email')}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={request.isPending}
          loadingText={t('auth.resend.sending')}
        >
          {t('auth.forgot.submit')}
        </Button>
      </form>
      <p className="mt-8 text-sm text-muted-foreground">
        <Link to="/sign-in" className={authLinkClass}>
          {t('auth.forgot.backToSignIn')}
        </Link>
      </p>
    </>
  );
}
