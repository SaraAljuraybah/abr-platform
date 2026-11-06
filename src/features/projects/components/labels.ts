import { useTranslation } from 'react-i18next';
import { TECH_SPECIALIZATIONS } from '../options';

/** Labels of stored codes; the keys are built from database values, so they are not literal types. */
export function useOptionLabels() {
  const { t } = useTranslation();
  const label = (key: string): string => t(key as never);
  return {
    track: (code: string) => label(`projects.options.track.${code}`),
    sector: (code: string) => label(`onboarding.options.interest.${code}`),
    year: (code: string) =>
      code === '2027_or_later' ? t('forms.interest.options.graduation_year.2027_or_later') : code,
    stage: (code: string) => label(`projects.options.stage.${code}`),
    // Tech specializations keep their field-of-study names.
    specialization: (code: string) =>
      (TECH_SPECIALIZATIONS as readonly string[]).includes(code)
        ? label(`forms.interest.options.field_of_study.${code}`)
        : label(`projects.options.specialization.${code}`),
    need: (code: string) => label(`projects.options.need.${code}`),
  };
}

/** A file size in the reader's language, in KB or MB with one decimal. */
export function useFileSize() {
  const { t, i18n } = useTranslation();
  return (bytes: number) => {
    const locale = i18n.language === 'ar' ? 'ar-u-nu-latn' : 'en';
    const format = (value: number) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
    return bytes >= 1024 * 1024
      ? t('projects.media.sizeMb', { value: format(bytes / (1024 * 1024)) })
      : t('projects.media.sizeKb', { value: format(Math.max(1, bytes / 1024)) });
  };
}
