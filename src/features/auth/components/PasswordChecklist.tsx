import { Check, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { PASSWORD_RULES } from '../schemas';

/**
 * Live password requirements. Each rule has an icon and a spoken state ("Done:" / "Not yet:"), so
 * the state never depends on colour. Not a live region: it is read with the field (describedby).
 */
export function PasswordChecklist({ value }: { value: string }) {
  const { t } = useTranslation();

  return (
    <div className="mt-1">
      <p className="sr-only">{t('auth.signUp.passwordRulesTitle')}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {PASSWORD_RULES.map(({ key, test }) => {
          const met = test(value);
          const Icon = met ? Check : Circle;
          return (
            <li
              key={key}
              data-met={met}
              className={cn(
                'flex items-center gap-2',
                met ? 'text-success' : 'text-muted-foreground',
              )}
            >
              <Icon aria-hidden="true" strokeWidth={met ? 2 : 1.75} className="size-4 shrink-0" />
              <span>
                <span className="sr-only">
                  {met ? t('auth.signUp.ruleMet') : t('auth.signUp.ruleNotMet')}{' '}
                </span>
                {t(`auth.signUp.passwordRules.${key}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
