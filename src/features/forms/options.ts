import type { TFunction } from 'i18next';

/**
 * Turns an option list (stable codes) into { value, label } items. `prefix` is the i18n path of
 * the labels, e.g. 'forms.interest.options.sector' → t('forms.interest.options.sector.energy').
 */
export function optionItems(
  t: TFunction,
  prefix: string,
  values: readonly string[],
): { value: string; label: string }[] {
  return values.map((value) => ({ value, label: t(`${prefix}.${value}` as never) }));
}
