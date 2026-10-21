import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import type en from '@/locales/en.json';

export type PlaceholderPageKey = keyof typeof en.placeholder.pages;

/** Stand-in for screens delivered by later stories. */
export function PlaceholderPage({ page }: { page: PlaceholderPageKey }) {
  const { t } = useTranslation();

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-brand">{t(`placeholder.pages.${page}`)}</h1>
      <p className="mt-4 text-muted-foreground">{t('placeholder.body')}</p>
      <Button asChild variant="outline" className="mt-8">
        <Link to="/">{t('placeholder.backHome')}</Link>
      </Button>
    </section>
  );
}
