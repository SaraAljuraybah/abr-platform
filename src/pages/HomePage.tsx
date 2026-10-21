import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function HomePage() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-sm font-semibold text-pink-text">{t('home.eyebrow')}</p>
      <h1 className="mt-3 max-w-3xl text-brand">{t('home.title')}</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{t('home.body')}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link to="/sign-up">{t('home.ctaSignUp')}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/sign-in">{t('home.ctaSignIn')}</Link>
        </Button>
      </div>

      <p className="mt-12 inline-flex items-center gap-2 rounded-md bg-info-bg px-3 py-2 text-sm text-info">
        <Info aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
        {t('home.buildNotice')}
      </p>
    </section>
  );
}
