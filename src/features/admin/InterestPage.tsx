import { useTranslation } from 'react-i18next';
import { type InterestRow, useInterestStats } from './api';
import { AdminLoadError, AdminLoading } from './components/states';

/** get_interest_stats dimensions, in the order the admin reads them. */
const DIMENSIONS = [
  'role',
  'university',
  'field_of_study',
  'graduation_year',
  'project_stage',
  'sector',
  'looking_for',
  'org_size',
  'expertise',
  'experience',
  'heard_from',
] as const;
type Dimension = (typeof DIMENSIONS)[number];

/** The interest form's own label for a stored code; an unknown code is shown as it is. */
function useAnswerLabel() {
  const { t, i18n } = useTranslation();
  return (dimension: Dimension, value: string): string => {
    const key =
      dimension === 'role'
        ? `auth.signUp.roles.${value}.title`
        : dimension === 'university'
          ? `forms.interest.options.university_code.${value}`
          : `forms.interest.options.${dimension}.${value}`;
    return i18n.exists(key) ? t(key as never) : value;
  };
}

const format = (value: number) => new Intl.NumberFormat('en').format(value);

/**
 * One dimension as a table: the answer, the count and its share. The bar is decorative
 * (aria-hidden): the numbers are in the table, so nothing depends on reading the bar.
 */
function DimensionTable({ dimension, rows }: { dimension: Dimension; rows: InterestRow[] }) {
  const { t } = useTranslation();
  const label = useAnswerLabel();
  const id = `interest-${dimension}`;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  const sorted = [...rows].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));

  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h2 id={id} className="text-lg font-bold text-brand">
        {t(`admin.interest.dimension.${dimension}`)}
      </h2>
      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('admin.interest.empty')}</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <caption className="sr-only">{t(`admin.interest.dimension.${dimension}`)}</caption>
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-2 pe-3 text-start font-semibold">
                {t('admin.interest.answer')}
              </th>
              <th scope="col" className="py-2 pe-3 text-end font-semibold">
                {t('admin.interest.count')}
              </th>
              <th scope="col" className="w-2/5 py-2 text-start font-semibold">
                {t('admin.interest.share')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const share = Math.round((row.count / total) * 100);
              return (
                <tr key={row.value} className="border-b border-border/60 last:border-0">
                  <th
                    scope="row"
                    dir="auto"
                    className="py-2 pe-3 text-start font-normal text-foreground"
                  >
                    {label(dimension, row.value)}
                  </th>
                  <td className="py-2 pe-3 text-end font-semibold text-foreground tabular-nums">
                    {format(row.count)}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div aria-hidden="true" className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-e-full bg-primary"
                          style={{ width: `${String((row.count / max) * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 text-end text-muted-foreground tabular-nums">
                        {share}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** /admin/interest: interest-form counts per dimension. Counts only, never personal data. */
export function InterestPage() {
  const { t } = useTranslation();
  const stats = useInterestStats();
  const total = stats.data
    ?.filter((row) => row.dimension === 'role')
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <h1 className="auth-title text-brand">{t('admin.interest.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('admin.interest.intro')}</p>
      <div className="mt-8">
        {stats.isPending ? (
          <AdminLoading />
        ) : stats.isError ? (
          <AdminLoadError retrying={stats.isRefetching} onRetry={() => void stats.refetch()} />
        ) : (
          <div className="flex flex-col gap-6">
            <p className="text-lg">
              <span className="text-muted-foreground">{t('admin.interest.total')}: </span>
              <span className="font-bold text-foreground">{format(total ?? 0)}</span>
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              {DIMENSIONS.map((dimension) => (
                <DimensionTable
                  key={dimension}
                  dimension={dimension}
                  rows={stats.data.filter((row) => row.dimension === dimension)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
