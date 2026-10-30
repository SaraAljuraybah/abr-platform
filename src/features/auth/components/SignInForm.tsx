import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/text-field';
import { isValidationKey } from '@/lib/zod-i18n';
import { useResendConfirmation, useSignIn } from '../api';
import { signInSchema, type SignInValues } from '../schemas';

// First-strong isolate: keeps an LTR email intact inside an Arabic sentence.
const isolate = (text: string) => `\u2068${text}\u2069`;

export function SignInForm() {
  const { t } = useTranslation();
  const signIn = useSignIn();
  const resend = useResendConfirmation();
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  // A new failure is a new error object: move focus to the message so it is read once.
  useEffect(() => {
    if (signIn.error) errorRef.current?.focus();
  }, [signIn.error]);

  const fieldError = (message: string | undefined) =>
    isValidationKey(message) ? t(message) : undefined;

  const onSubmit = handleSubmit((values) => {
    resend.reset();
    signIn.mutate(values);
  });

  const failure = signIn.error?.kind;
  const submittedEmail = signIn.variables?.email ?? '';

  return (
    <>
      <h1 className="text-brand">{t('auth.signIn.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('auth.signIn.subtitle')}</p>

      {failure && (
        <Callout ref={errorRef} tabIndex={-1} variant="error" className="mt-6">
          <p>
            {failure === 'emailNotConfirmed'
              ? t('auth.errors.emailNotConfirmed', { email: isolate(submittedEmail) })
              : t(`auth.errors.${failure}`)}
          </p>
          {failure === 'emailNotConfirmed' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              loading={resend.isPending}
              loadingText={t('auth.resend.sending')}
              onClick={() => {
                resend.mutate({ email: submittedEmail });
              }}
            >
              {t('auth.resend.action')}
            </Button>
          )}
        </Callout>
      )}

      {resend.isSuccess && (
        <Callout live variant="info" className="mt-3">
          <p>{t('auth.resend.sent')}</p>
        </Callout>
      )}
      {resend.error && (
        <Callout live variant="error" className="mt-3">
          <p>{t(`auth.errors.${resend.error.kind}`)}</p>
        </Callout>
      )}

      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="mt-6 flex flex-col gap-5"
      >
        <TextField
          label={t('auth.signIn.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          dir="ltr"
          error={fieldError(errors.email?.message)}
          {...register('email')}
        />
        <div className="flex flex-col gap-2">
          <PasswordField
            label={t('auth.signIn.password')}
            autoComplete="current-password"
            error={fieldError(errors.password?.message)}
            {...register('password')}
          />
          <Link
            to="/forgot-password"
            className="self-start rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t('auth.signIn.forgotPassword')}
          </Link>
        </div>
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={signIn.isPending || signIn.isSuccess}
          loadingText={t('auth.signIn.submitting')}
        >
          {t('auth.signIn.submit')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t('auth.signIn.newToAbr')}{' '}
        <Link
          to="/sign-up"
          className="rounded-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t('auth.signIn.createAccount')}
        </Link>
      </p>
    </>
  );
}
