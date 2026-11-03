import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * Spam trap: hidden from people and assistive technology; bots fill it. The label is an
 * instruction, so anyone who still reaches it knows to leave it empty. A filled trap gets the
 * normal success and no request (forms check it before submitting; servers drop it too).
 */
export function SpamTrap(props: UseFormRegisterReturn) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div aria-hidden="true" className="sr-only">
      <label htmlFor={id}>{t('forms.common.honeypotLabel')}</label>
      <input id={id} type="text" tabIndex={-1} autoComplete="off" {...props} />
    </div>
  );
}
