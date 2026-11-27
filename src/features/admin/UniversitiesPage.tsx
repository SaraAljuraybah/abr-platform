import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SyntheticEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { toastStore } from '@/components/ui/toast-store';
import { useDirection } from '@/hooks/useDirection';
import { supabase } from '@/lib/supabase';
import { AdminLoadError, AdminLoading } from './components/states';

const KEY = ['admin', 'universities'] as const;

/** Every university and its domains. RLS: admins read all rows (is_admin()), others none. */
function useUniversityDomains() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('universities')
        .select(
          'id, name_ar, name_en, kind, active, domains:university_email_domains(id, domain, active)',
        );
      if (error) throw error;
      return data;
    },
  });
}

type DomainErrorKind = 'taken' | 'invalid' | 'unexpected';
class DomainError extends Error {
  constructor(readonly kind: DomainErrorKind) {
    super(kind);
    this.name = 'DomainError';
  }
}
function toDomainError(error: unknown): DomainError {
  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') return new DomainError('taken');
  if (code === '22023') return new DomainError('invalid');
  console.error('Domain change failed', error);
  return new DomainError('unexpected');
}

/** /admin/universities: add a student email domain, or turn one off (audited RPCs, admin only). */
export function UniversitiesPage() {
  const { t } = useTranslation();
  const { language } = useDirection();
  const queryClient = useQueryClient();
  const query = useUniversityDomains();
  const [universityId, setUniversityId] = useState('');
  const [domain, setDomain] = useState('');

  const add = useMutation<null, DomainError, { universityId: string; domain: string }>({
    mutationFn: async (input) => {
      const { error } = await supabase.rpc('admin_add_university_domain', {
        p_university_id: input.universityId,
        p_domain: input.domain,
      });
      if (error) throw toDomainError(error);
      return null;
    },
    onSuccess: () => {
      toastStore.show(t('admin.universities.added'));
      setDomain('');
      void queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
  const toggle = useMutation({
    mutationFn: async (input: { id: string; active: boolean }) => {
      const { error } = await supabase.rpc('admin_set_university_domain_active', {
        p_domain_id: input.id,
        p_active: input.active,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  const name = (row: { name_ar: string; name_en: string }) =>
    language === 'ar' ? row.name_ar : row.name_en;
  const collator = new Intl.Collator(language);
  const rows = (query.data ?? []).slice().sort((a, b) => collator.compare(name(a), name(b)));

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!universityId || domain.trim() === '') return;
    add.mutate({ universityId, domain });
  };

  return (
    <>
      <h1 className="auth-title text-brand">{t('admin.universities.title')}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t('admin.universities.intro')}</p>

      {query.isPending ? (
        <div className="mt-6">
          <AdminLoading />
        </div>
      ) : query.isError ? (
        <div className="mt-6">
          <AdminLoadError retrying={query.isRefetching} onRetry={() => void query.refetch()} />
        </div>
      ) : (
        <>
          <form
            onSubmit={submit}
            noValidate
            aria-labelledby="add-domain-title"
            className="mt-6 flex max-w-2xl flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
          >
            <h2 id="add-domain-title" className="text-lg font-bold text-brand">
              {t('admin.universities.addTitle')}
            </h2>
            <SelectField
              label={t('admin.universities.university')}
              value={universityId}
              onChange={(event) => {
                setUniversityId(event.target.value);
              }}
            >
              <option value="">{t('onboarding.select')}</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {name(row)}
                </option>
              ))}
            </SelectField>
            <TextField
              label={t('admin.universities.domain')}
              hint={t('admin.universities.domainHint')}
              dir="ltr"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="students.example.edu.sa"
              value={domain}
              onChange={(event) => {
                setDomain(event.target.value);
              }}
            />
            {add.error && (
              <Callout variant="error" live>
                <p>{t(`admin.universities.errors.${add.error.kind}`)}</p>
              </Callout>
            )}
            <div>
              <Button
                type="submit"
                disabled={!universityId || domain.trim() === ''}
                loading={add.isPending}
                loadingText={t('admin.verifications.sending')}
              >
                {t('admin.universities.add')}
              </Button>
            </div>
          </form>

          {toggle.isError && (
            <Callout variant="error" live className="mt-6 max-w-2xl">
              <p>{t('admin.universities.errors.unexpected')}</p>
            </Callout>
          )}

          <ul className="mt-8 flex flex-col gap-3" aria-label={t('admin.universities.listLabel')}>
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-foreground">{name(row)}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.kind
                      ? t(
                          `auth.signUp.universityGroups.${row.kind === 'private' ? 'private' : 'public'}`,
                        )
                      : null}
                  </p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {row.domains.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm"
                    >
                      <span
                        dir="ltr"
                        className={
                          d.active ? 'text-foreground' : 'text-muted-foreground line-through'
                        }
                      >
                        {d.domain}
                      </span>
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary underline underline-offset-4"
                        disabled={toggle.isPending}
                        aria-label={
                          d.active
                            ? t('admin.universities.disableLabel', { domain: d.domain })
                            : t('admin.universities.enableLabel', { domain: d.domain })
                        }
                        onClick={() => {
                          toggle.mutate({ id: d.id, active: !d.active });
                        }}
                      >
                        {d.active
                          ? t('admin.universities.disable')
                          : t('admin.universities.enable')}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
