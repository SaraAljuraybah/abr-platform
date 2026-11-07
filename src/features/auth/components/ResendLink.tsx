import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { TextField } from '@/components/ui/text-field';
import { validationMessage, z } from '@/lib/zod-i18n';
import { useRequestPasswordReset, useResendConfirmation } from '../api';
import { signInSchema } from '../schemas';
import { formatCountdown, useCooldown } from '../use-cooldown';

/** Matches Supabase Auth's one-email-per-minute limit, so the button rarely meets a 429. */
export const RESEND_COOLDOWN_SECONDS = 60;

const emailSchema = z.object({ email: signInSchema.shape.email });
type EmailValues = z.infer<typeof emailSchema>;

/**
 * "Resend link" with a cooldown that starts on page load and again after every successful send.
 * With `email`, a single button sends to that address; without it, the user types the address.
 * `purpose` picks the link: the sign-up confirmation (default) or a password reset (SCRUM-13, page 4).
 * Errors use the sign-in mapping (toAuthFailure); none of them says whether an account exists.
 */
export function ResendLink({
  email,
  purpose = 'signup',
}: {
  email?: string;
  purpose?: 'signup' | 'recovery';
}) {
  const { t } = useTranslation();
  const confirmation = useResendConfirmation();
  const reset = useRequestPasswordReset();
  const resend = purpose === 'recovery' ? reset : confirmation;
  const { secondsLeft, restart } = useCooldown(RESEND_COOLDOWN_SECONDS);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const send = (address: string) => {
    resend.mutate({ email: address }, { onSuccess: restart });
  };

  const button = (
    <Button
      type={email === undefined ? 'submit' : 'button'}
      variant="outline"
      className="w-full sm:w-auto"
      loading={resend.isPending}
      loadingText={t('auth.resend.sending')}
      disabled={secondsLeft > 0}
      onClick={
        email === undefined
          ? undefined
          : () => {
              send(email);
            }
      }
    >
      {secondsLeft > 0
        ? t('auth.resend.cooldown', { time: formatCountdown(secondsLeft) })
        : t('auth.resend.action')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      {email === undefined ? (
        <form
          noValidate
          onSubmit={(event) =>
            void handleSubmit((values) => {
              send(values.email);
            })(event)
          }
          className="flex flex-col gap-4"
        >
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
          {button}
        </form>
      ) : (
        button
      )}

      {/* Always in the DOM, so the polite announcement is not lost when the message appears. */}
      <div role="status" aria-live="polite">
        {resend.isSuccess && (
          <Callout variant="info">
            <p>{t('auth.resend.sent')}</p>
          </Callout>
        )}
      </div>
      {resend.error && (
        <Callout live variant="error">
          <p>{t(`auth.errors.${resend.error.kind}`)}</p>
        </Callout>
      )}
    </div>
  );
}
