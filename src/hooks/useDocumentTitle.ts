import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * A page's own document title while it is mounted ("Privacy Policy · ABR"). Runs again after a
 * language change, after applyDocumentLanguage() has reset the site title, and restores the site
 * title when the page unmounts.
 */
export function useDocumentTitle(title: string): void {
  const { t } = useTranslation();
  const siteTitle = t('meta.title');
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = siteTitle;
    };
  }, [title, siteTitle]);
}
