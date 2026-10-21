import { useTranslation } from 'react-i18next';

export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6">
      <p role="status" className="text-muted-foreground">
        {t('app.loading')}
      </p>
    </div>
  );
}
