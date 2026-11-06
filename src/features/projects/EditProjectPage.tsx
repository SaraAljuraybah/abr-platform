import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { type Resolver, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useBlocker, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CharacterCount } from '@/components/ui/field-number';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { TextareaField } from '@/components/ui/textarea-field';
import { toastStore } from '@/components/ui/toast-store';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';
import { validationMessage } from '@/lib/zod-i18n';
import { type Project, useDeleteProject, useProject, useUpdateProject } from './api';
import { ProjectStatusChip } from './components/ProjectStatusChip';
import { ProjectLoadError, ProjectNotFound, ProjectSkeleton } from './components/states';
import { ACADEMIC_YEARS, isEditable, PROJECT_LIMITS as L, SECTORS, TRACKS } from './options';
import { projectSchema, type ProjectValues } from './schemas';
import { page, panel } from './styles';

/**
 * /app/projects/:id/edit (students only; UX guard). The owner edits a draft (or a project with
 * changes requested) and saves explicitly; any other status is shown read-only. RLS decides what
 * is visible and editable: another user's project reads as "not found", and a save that RLS turns
 * into a no-op is reported, never shown as saved.
 */
export function EditProjectPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { session } = useAuth();
  const query = useProject(id);

  const title = t('projects.edit.title');
  if (!session) return null;
  if (query.isPending) return <ProjectSkeleton title={title} />;
  if (query.isError) {
    return (
      <ProjectLoadError
        title={title}
        retrying={query.isRefetching}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.data) return <ProjectNotFound />;
  if (!isEditable(query.data.status)) return <ProjectReadOnly project={query.data} />;
  // Keyed by id so another project never inherits this one's form state.
  return <ProjectEditor key={query.data.id} project={query.data} userId={session.user.id} />;
}

/** Labels of stored codes; the keys are built from database values, so they are not literal types. */
function useOptionLabels() {
  const { t } = useTranslation();
  const label = (key: string): string => t(key as never);
  return {
    track: (code: string) => label(`projects.options.track.${code}`),
    sector: (code: string) => label(`onboarding.options.interest.${code}`),
    year: (code: string) =>
      code === '2027_or_later' ? t('forms.interest.options.graduation_year.2027_or_later') : code,
  };
}

function toValues(project: Project): ProjectValues {
  return {
    title: project.title,
    summary: project.summary ?? '',
    description: project.description ?? '',
    track: project.track ?? '',
    sectors: project.sectors,
    academicYear: project.academicYear ?? '',
  };
}

function Header({ title, project }: { title: string; project: Project }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="auth-title text-brand">{title}</h1>
      <ProjectStatusChip status={project.status} />
    </div>
  );
}

function ProjectEditor({ project, userId }: { project: Project; userId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const labels = useOptionLabels();
  const save = useUpdateProject(project, userId);
  const remove = useDeleteProject(userId);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const sectorsHintId = useId();
  const sectorsErrorId = useId();
  // Set right before leaving on purpose (after a delete), so the unsaved-changes guard stays quiet.
  const leaving = useRef(false);

  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema) as unknown as Resolver<ProjectValues>,
    defaultValues: toValues(project),
  });
  const { isDirty, errors } = form.formState;
  const [title, summary, description, sectors] = useWatch({
    control: form.control,
    name: ['title', 'summary', 'description', 'sectors'],
  });

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );

  // A reload or a closed tab with unsaved changes gets the browser's own warning.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [isDirty]);

  useEffect(() => {
    if (save.error) errorRef.current?.focus();
  }, [save.error]);

  const onSubmit = form.handleSubmit((values) => {
    setSaved(false);
    save.mutate(values, {
      onSuccess: (project) => {
        form.reset(toValues(project));
        setSaved(true);
      },
    });
  });

  const onDelete = () => {
    remove.mutate(project.id, {
      onSuccess: () => {
        leaving.current = true;
        toastStore.show(t('projects.delete.done'));
        void navigate('/app', { replace: true });
      },
    });
  };

  const fieldError = (name: keyof ProjectValues) => validationMessage(t, errors[name]?.message);
  const atSectorLimit = sectors.length >= L.sectors.max;

  return (
    <div className={page}>
      <Header title={t('projects.edit.title')} project={project} />
      <p className="mt-2 max-w-3xl text-muted-foreground">{t('projects.edit.intro')}</p>

      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className={cn(panel, 'mt-8 flex max-w-3xl flex-col gap-6')}
      >
        {save.error && (
          <Callout ref={errorRef} tabIndex={-1} variant="error">
            <p>{t(`projects.errors.${save.error.kind}`)}</p>
          </Callout>
        )}

        <TextField
          label={t('projects.fields.title')}
          maxLength={L.title.max}
          autoComplete="off"
          error={fieldError('title')}
          details={<CharacterCount value={title.length} max={L.title.max} />}
          {...form.register('title')}
        />
        <TextareaField
          label={t('projects.fields.summary')}
          hint={t('projects.fields.summaryHint')}
          rows={3}
          maxLength={L.summary.max}
          error={fieldError('summary')}
          details={<CharacterCount value={summary.length} max={L.summary.max} />}
          {...form.register('summary')}
        />
        <TextareaField
          label={t('projects.fields.description')}
          hint={t('projects.fields.descriptionHint')}
          rows={8}
          maxLength={L.description.max}
          error={fieldError('description')}
          details={<CharacterCount value={description.length} max={L.description.max} />}
          {...form.register('description')}
        />
        <SelectField
          label={t('projects.fields.track')}
          error={fieldError('track')}
          {...form.register('track')}
        >
          <option value="">{t('projects.fields.trackPlaceholder')}</option>
          {TRACKS.map((code) => (
            <option key={code} value={code}>
              {labels.track(code)}
            </option>
          ))}
        </SelectField>

        <fieldset
          aria-describedby={errors.sectors ? `${sectorsHintId} ${sectorsErrorId}` : sectorsHintId}
          className="flex flex-col gap-2"
        >
          <legend className="mb-1.5 text-sm font-semibold text-foreground">
            {t('projects.fields.sectors')}
          </legend>
          <p id={sectorsHintId} className="text-sm text-muted-foreground">
            {t('projects.fields.sectorsHint', { max: L.sectors.max })}
          </p>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((code) => (
              <label
                key={code}
                className={cn(
                  'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-muted-foreground/80 bg-card px-4 text-sm text-foreground transition-colors hover:bg-accent',
                  'has-checked:border-primary has-checked:bg-secondary',
                  'has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:bg-card',
                )}
              >
                <input
                  type="checkbox"
                  value={code}
                  disabled={atSectorLimit && !sectors.includes(code)}
                  className="size-4 shrink-0 accent-primary"
                  {...form.register('sectors')}
                />
                {labels.sector(code)}
              </label>
            ))}
          </div>
          {errors.sectors && (
            <p id={sectorsErrorId} className="text-sm text-error">
              {fieldError('sectors')}
            </p>
          )}
        </fieldset>

        <SelectField
          label={t('projects.fields.academicYear')}
          hint={t('projects.fields.academicYearHint')}
          error={fieldError('academicYear')}
          {...form.register('academicYear')}
        >
          <option value="">{t('projects.fields.academicYearPlaceholder')}</option>
          {ACADEMIC_YEARS.map((code) => (
            <option key={code} value={code}>
              {labels.year(code)}
            </option>
          ))}
        </SelectField>

        <div className="flex flex-col-reverse gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          {project.status === 'draft' ? (
            <Dialog
              open={deleteOpen}
              onOpenChange={(open) => {
                if (open) remove.reset();
                setDeleteOpen(open);
              }}
            >
              {/* The trigger gets focus back when the dialog closes. */}
              <DialogTrigger asChild>
                <Button type="button" variant="outline" className="text-error">
                  {t('projects.delete.button')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>{t('projects.delete.title')}</DialogTitle>
                <DialogDescription>
                  {t('projects.delete.body', { title: project.title })}
                </DialogDescription>
                {remove.error && (
                  <Callout variant="error" live>
                    <p>{t(`projects.errors.${remove.error.kind}`)}</p>
                  </Callout>
                )}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={remove.isPending}>
                      {t('projects.delete.cancel')}
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    variant="destructive"
                    loading={remove.isPending}
                    loadingText={t('projects.delete.deleting')}
                    onClick={onDelete}
                  >
                    {t('projects.delete.confirm')}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="flex flex-wrap items-center gap-4">
            <p role="status" className="flex items-center gap-1.5 text-sm text-success">
              {saved && !isDirty && !save.isPending && (
                <>
                  <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-4" />
                  {t('projects.save.saved')}
                </>
              )}
            </p>
            <Button type="submit" loading={save.isPending} loadingText={t('projects.save.saving')}>
              {t('projects.save.button')}
            </Button>
          </div>
        </div>
      </form>

      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <DialogContent>
          <DialogTitle>{t('projects.unsaved.title')}</DialogTitle>
          <DialogDescription>{t('projects.unsaved.body')}</DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => blocker.proceed?.()}>
              {t('projects.unsaved.leave')}
            </Button>
            <Button type="button" onClick={() => blocker.reset?.()}>
              {t('projects.unsaved.stay')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line text-foreground">{children}</dd>
    </div>
  );
}

/** Any status the owner cannot edit in: what was submitted, with a note on why it is locked. */
function ProjectReadOnly({ project }: { project: Project }) {
  const { t } = useTranslation();
  const labels = useOptionLabels();
  const none = <span className="text-muted-foreground">{t('projects.notSet')}</span>;
  return (
    <div className={page}>
      <Header title={t('projects.readOnly.title')} project={project} />
      <Callout className="mt-6 max-w-3xl">
        <p>{t('projects.readOnly.notice')}</p>
      </Callout>
      <dl className={cn(panel, 'mt-6 flex max-w-3xl flex-col gap-4')}>
        <Row label={t('projects.fields.title')}>
          <span dir="auto">{project.title}</span>
        </Row>
        <Row label={t('projects.fields.summary')}>
          {project.summary ? <span dir="auto">{project.summary}</span> : none}
        </Row>
        <Row label={t('projects.fields.description')}>
          {project.description ? <span dir="auto">{project.description}</span> : none}
        </Row>
        <Row label={t('projects.fields.track')}>
          {project.track ? labels.track(project.track) : none}
        </Row>
        <Row label={t('projects.fields.sectors')}>
          {project.sectors.length > 0 ? (
            <ul aria-label={t('projects.fields.sectors')} className="flex flex-wrap gap-2">
              {project.sectors.map((code) => (
                <li
                  key={code}
                  className="rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-sm"
                >
                  {labels.sector(code)}
                </li>
              ))}
            </ul>
          ) : (
            none
          )}
        </Row>
        <Row label={t('projects.fields.academicYear')}>
          {project.academicYear ? labels.year(project.academicYear) : none}
        </Row>
      </dl>
    </div>
  );
}
