import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { linkClass } from '@/features/forms/styles';

/**
 * Phase 1 launch mode (VITE_AUTH_ENABLED=false): shown in FormLayout at /sign-in, /sign-up and
 * /forms/request-access, and where the protected routes redirect. Points to the interest form.
 */
export function ComingSoonPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-start">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-muted text-primary"
      >
        <Clock3 strokeWidth={1.75} className="size-6" />
      </span>
      <h1 className="auth-title mt-5 text-brand">{t('comingSoon.title')}</h1>
      <p className="mt-3 text-muted-foreground">{t('comingSoon.body')}</p>
      <Button asChild className="mt-8">
        <Link to="/forms/interest">{t('comingSoon.cta')}</Link>
      </Button>
      <Link to="/" className={`mt-5 ${linkClass}`}>
        {t('comingSoon.backHome')}
      </Link>
    </div>
  );
}
