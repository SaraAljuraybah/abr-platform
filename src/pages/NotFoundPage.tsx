import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-sm font-semibold text-muted-foreground">{t('notFound.code')}</p>
      <h1 className="mt-2 text-brand">{t('notFound.title')}</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">{t('notFound.body')}</p>
      <Button asChild className="mt-8">
        <Link to="/">{t('notFound.backHome')}</Link>
      </Button>
    </section>
  );
}
