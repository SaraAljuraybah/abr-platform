import { SearchX, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/features/auth/auth-context';
import { page, panel } from '@/features/projects/styles';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { cn } from '@/lib/utils';
import { type DirectoryPage, useDirectory, usePageImageUrls } from './api';
import { FilterFields } from './components/FilterFields';
import { ProjectCard, ProjectCardSkeleton } from './components/ProjectCard';
import {
  activeFilterCount,
  type DirectoryFilters,
  isFiltered,
  NO_FILTERS,
  parseFilters,
  SEARCH_MAX,
  type SortKey,
  toSearchParams,
} from './search-params';

const SEARCH_DEBOUNCE_MS = 300;
const grid = 'grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

/** The search box keeps its own text and writes it to the URL once typing pauses. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // The URL changed elsewhere ("Clear filters", back/forward): show its value.
  if (value !== synced) {
    setSynced(value);
    if (draft.trim() !== value) setDraft(value);
  }

  useEffect(() => {
    if (draft.trim() === value) return;
    const timer = setTimeout(() => {
      onCommit(draft.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, value, onCommit]);

  return (
    <TextField
      type="search"
      label={t('explore.search')}
      value={draft}
      maxLength={SEARCH_MAX}
      dir="auto"
      autoComplete="off"
      enterKeyHint="search"
      className="min-w-0 flex-1"
      onChange={(event) => {
        setDraft(event.target.value);
      }}
    />
  );
}

/** One loaded page of cards. Its images are signed together, in one request. */
function CardPage({ data, linkState }: { data: DirectoryPage; linkState: unknown }) {
  const paths = data.cards.flatMap((card) => (card.imagePath ? [card.imagePath] : []));
  const urls = usePageImageUrls(paths);
  return data.cards.map((card) => (
    <li key={card.id} className="min-w-0">
      <ProjectCard
        card={card}
        linkState={linkState}
        signed={{
          url: card.imagePath ? urls.data?.[card.imagePath] : undefined,
          pending: urls.isPending && paths.length > 0,
        }}
      />
    </li>
  ));
}

/** Shown instead of the directory to anyone who is not verified. No query is sent. */
export function VerificationRequired({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div className={page}>
      <h1 className="auth-title text-brand">{title}</h1>
      <EmptyState
        icon={ShieldCheck}
        className="mt-8 max-w-2xl"
        action={
          <Button asChild variant="outline">
            <Link to="/app">{t('projects.backToDashboard')}</Link>
          </Button>
        }
      >
        {t('explore.verificationRequired')}
      </EmptyState>
    </div>
  );
}

/**
 * /projects (SCRUM-20): published projects of verified students, for verified users of every role.
 * Search, filters and sort live in the URL. RLS decides what can be returned (D-15).
 */
export function ExplorePage() {
  const { t } = useTranslation();
  const { verificationStatus } = useAuth();
  useDocumentTitle(t('explore.metaTitle'));
  if (verificationStatus !== 'verified') return <VerificationRequired title={t('explore.title')} />;
  return <Directory />;
}

function Directory() {
  const { t } = useTranslation();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const directory = useDirectory(filters, true);

  const update = useCallback(
    (next: DirectoryFilters) => {
      setParams(toSearchParams(next), { replace: true });
    },
    [setParams],
  );
  const commitSearch = useCallback(
    (q: string) => {
      setParams((current) => toSearchParams({ ...parseFilters(current), q }), { replace: true });
    },
    [setParams],
  );
  const clear = () => {
    update({ ...NO_FILTERS, sort: filters.sort });
  };

  const count = activeFilterCount(filters);
  const filtersLabel = count > 0 ? t('explore.filtersCount', { count }) : t('explore.filters');
  const [panelOpen, setPanelOpen] = useState(count > 0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const pages = directory.data?.pages ?? [];
  const total = pages[0]?.total;
  // Back from a project returns to the same results.
  const linkState = { from: `${location.pathname}${location.search}` };

  return (
    <div className={page}>
      <h1 className="auth-title text-brand">{t('explore.title')}</h1>
      <p className="mt-2 text-muted-foreground">{t('explore.intro')}</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <SearchBox value={filters.q} onCommit={commitSearch} />
        <SelectField
          label={t('explore.sort')}
          className="sm:w-52"
          value={filters.sort}
          onChange={(event) => {
            update({ ...filters, sort: event.target.value as SortKey });
          }}
        >
          <option value="newest">{t('explore.sortNewest')}</option>
          <option value="title">{t('explore.sortTitle')}</option>
        </SelectField>
        {/* Below lg: the filters open in a dialog. */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="lg:hidden"
          aria-haspopup="dialog"
          onClick={() => {
            setDialogOpen(true);
          }}
        >
          <SlidersHorizontal aria-hidden="true" strokeWidth={1.75} />
          {filtersLabel}
        </Button>
        {/* From lg: an inline panel behind a disclosure button. */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="hidden lg:inline-flex"
          aria-expanded={panelOpen}
          aria-controls="explore-filters"
          onClick={() => {
            setPanelOpen((open) => !open);
          }}
        >
          <SlidersHorizontal aria-hidden="true" strokeWidth={1.75} />
          {filtersLabel}
        </Button>
      </div>

      <section
        id="explore-filters"
        aria-label={t('explore.filters')}
        hidden={!panelOpen}
        className={cn(panel, 'mt-4 hidden sm:p-6', panelOpen && 'lg:block')}
      >
        <FilterFields filters={filters} onChange={update} />
        {isFiltered(filters) && (
          <Button type="button" variant="link" className="mt-4 px-0" onClick={clear}>
            {t('explore.clearFilters')}
          </Button>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{t('explore.filters')}</DialogTitle>
          <DialogDescription>{t('explore.filtersDescription')}</DialogDescription>
          <FilterFields filters={filters} onChange={update} />
          <DialogFooter>
            <Button type="button" variant="outline" disabled={!isFiltered(filters)} onClick={clear}>
              {t('explore.clearFilters')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setDialogOpen(false);
              }}
            >
              {t('explore.showResults')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One polite live region for the result count (and the first load). */}
      <p role="status" className="mt-6 min-h-5 text-sm font-semibold text-foreground">
        {directory.isPending
          ? t('explore.loading')
          : total !== undefined
            ? t('explore.results', { count: total })
            : null}
      </p>

      <div className="mt-3">
        {directory.isPending ? (
          <ul aria-hidden="true" className={grid}>
            {Array.from({ length: 8 }, (_, index) => (
              <li key={index}>
                <ProjectCardSkeleton />
              </li>
            ))}
          </ul>
        ) : directory.isError && pages.length === 0 ? (
          <Callout variant="error" live className="max-w-2xl">
            <p>{t('explore.loadError')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              loading={directory.isRefetching}
              loadingText={t('projects.retrying')}
              onClick={() => void directory.refetch()}
            >
              {t('projects.retry')}
            </Button>
          </Callout>
        ) : total === 0 ? (
          <EmptyState
            icon={SearchX}
            className="max-w-2xl"
            action={
              isFiltered(filters) ? (
                <Button type="button" variant="outline" onClick={clear}>
                  {t('explore.clearFilters')}
                </Button>
              ) : undefined
            }
          >
            {isFiltered(filters) ? t('explore.empty') : t('explore.emptyNone')}
          </EmptyState>
        ) : (
          <>
            <ul className={grid}>
              {pages.map((data) => (
                <CardPage key={data.offset} data={data} linkState={linkState} />
              ))}
            </ul>
            {directory.isFetchNextPageError && (
              <Callout variant="error" live className="mt-6 max-w-2xl">
                <p>{t('explore.loadError')}</p>
              </Callout>
            )}
            {directory.hasNextPage && (
              <div className="mt-8 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  loading={directory.isFetchingNextPage}
                  loadingText={t('explore.loadingMore')}
                  onClick={() => void directory.fetchNextPage()}
                >
                  {t('explore.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
