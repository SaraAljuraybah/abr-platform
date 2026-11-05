import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export type ComingNextKey = 'profile' | 'newProject';

/** Signed-in pages that later stories deliver (/app/profile, /app/projects/new). */
export function ComingNextPage({ page }: { page: ComingNextKey }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto w-full max-w-[1120px] px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="auth-title text-brand">{t(`comingNext.${page}`)}</h1>
      <EmptyState
        icon={Construction}
        className="mt-8 max-w-2xl"
        action={
          <Button asChild variant="outline">
            <Link to="/app">{t('comingNext.backToDashboard')}</Link>
          </Button>
        }
      >
        {t('comingNext.body')}
      </EmptyState>
    </div>
  );
}
