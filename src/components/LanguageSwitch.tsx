import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useDirection } from '@/hooks/useDirection';
import { changeLanguage, type Language } from '@/lib/i18n';

export function LanguageSwitch() {
  const { t } = useTranslation();
  const { language } = useDirection();
  const target: Language = language === 'ar' ? 'en' : 'ar';

  return (
    <Button variant="ghost" size="sm" onClick={() => void changeLanguage(target)}>
      <Languages aria-hidden="true" strokeWidth={1.75} />
      {/* Accessible name includes the visible text (WCAG 2.5.3). */}
      <span className="sr-only">{t('language.switchLabel')}: </span>
      <span lang={target}>{t('language.switchTo')}</span>
    </Button>
  );
}
