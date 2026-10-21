import { useTranslation } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  type Direction,
  directionOf,
  isLanguage,
  type Language,
} from '@/lib/i18n';

export function useDirection(): { language: Language; direction: Direction } {
  const { i18n } = useTranslation();
  const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE;
  return { language, direction: directionOf(language) };
}
