import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { SpamTrap } from './SpamTrap';

interface FormShellProps {
  title: ReactNode;
  intro?: ReactNode;
  onSubmit: ComponentProps<'form'>['onSubmit'];
  /** register('website') of the form: the hidden spam-trap field. */
  spamTrap: UseFormRegisterReturn;
  /** Already-translated failure message, shown above the submit button. */
  error?: ReactNode;
  /**
   * Identity of the current failure (a new object per failure). Focus moves to the message when it
   * changes, so a new failure is read once; the message is not a live region.
   */
  errorToken?: unknown;
  submitLabel: string;
  submittingLabel: string;
  submitting: boolean;
  /** Under the submit button (e.g. the consent line). */
  afterSubmit?: ReactNode;
  /** Below the form (e.g. "Already have an account?"). */
  footer?: ReactNode;
  /** The fields, in order: role choice, numbered fields, consent. */
  children: ReactNode;
}

/**
 * The frame every ABR form shares (sign-up, /forms/*): title and intro, the fields, the spam trap,
 * one focused error message, the submit button with its loading state, and the consent line.
 */
export function FormShell({
  title,
  intro,
  onSubmit,
  spamTrap,
  error,
  errorToken,
  submitLabel,
  submittingLabel,
  submitting,
  afterSubmit,
  footer,
  children,
}: FormShellProps) {
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorToken) errorRef.current?.focus();
  }, [errorToken]);

  return (
    <>
      <h1 className="auth-title text-brand">{title}</h1>
      {intro && <p className="mt-2 text-muted-foreground">{intro}</p>}

      <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
        {children}

        <SpamTrap {...spamTrap} />

        {error && (
          <Callout ref={errorRef} tabIndex={-1} variant="error">
            <p>{error}</p>
          </Callout>
        )}

        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={submitting}
            loadingText={submittingLabel}
          >
            {submitLabel}
          </Button>
          {afterSubmit}
        </div>
      </form>

      {footer}
    </>
  );
}
