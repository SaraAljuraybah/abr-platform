import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type Resolver, useForm } from 'react-hook-form';
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
import { toastStore } from '@/components/ui/toast-store';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/utils';
import { type Project, useDeleteProject, useProject, useUpdateProject } from './api';
import {
  BasicsSection,
  EditorSection,
  LinksSection,
  NeedsSection,
  StageTeamSection,
} from './components/EditorSections';
import { DocumentField, ImageField } from './components/MediaSection';
import { ProjectReadOnly } from './components/ProjectReadOnly';
import { ProjectStatusChip } from './components/ProjectStatusChip';
import { ProjectLoadError, ProjectNotFound, ProjectSkeleton } from './components/states';
import { isEditable } from './options';
import { projectSchema, type ProjectValues } from './schemas';
import { page, panel } from './styles';

/**
 * /app/projects/:id/edit (students only; UX guard). The owner edits a draft (or a project with
 * changes requested) in five sections and saves explicitly; the image and document save as soon as
 * they are uploaded. Any other status is shown read-only. RLS decides what is visible and editable:
 * another user's project reads as "not found", and a save that RLS turns into a no-op is reported,
 * never shown as saved. Storage policies decide the same for files.
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

function toValues(project: Project): ProjectValues {
  return {
    title: project.title,
    summary: project.summary ?? '',
    description: project.description ?? '',
    track: project.track ?? '',
    sectors: project.sectors,
    academicYear: project.academicYear ?? '',
    stage: project.stage ?? '',
    teamSize: project.teamSize,
    lookingForMembers: project.lookingForMembers,
    wantedSpecializations: project.wantedSpecializations,
    needs: project.needs,
    videoUrl: project.videoUrl ?? '',
    repoUrl: project.repoUrl ?? '',
    demoUrl: project.demoUrl ?? '',
  };
}

function ProjectEditor({ project, userId }: { project: Project; userId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const save = useUpdateProject(project, userId);
  const remove = useDeleteProject(userId);
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  // Set right before leaving on purpose (after a delete), so the unsaved-changes guard stays quiet.
  const leaving = useRef(false);

  const form = useForm<ProjectValues>({
    resolver: zodResolver(projectSchema) as unknown as Resolver<ProjectValues>,
    defaultValues: toValues(project),
  });
  const { isDirty } = form.formState;

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
      onSuccess: (savedProject) => {
        form.reset(toValues(savedProject));
        setSaved(true);
      },
    });
  });

  const onDelete = () => {
    remove.mutate(project, {
      onSuccess: () => {
        leaving.current = true;
        toastStore.show(t('projects.delete.done'));
        void navigate('/app', { replace: true });
      },
    });
  };

  return (
    <div className={page}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="auth-title text-brand">{t('projects.edit.title')}</h1>
        <ProjectStatusChip status={project.status} />
      </div>
      <p className="mt-2 max-w-3xl text-muted-foreground">{t('projects.edit.intro')}</p>

      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="mt-8 flex max-w-3xl flex-col gap-6"
      >
        {save.error && (
          <Callout ref={errorRef} tabIndex={-1} variant="error">
            <p>{t(`projects.errors.${save.error.kind}`)}</p>
          </Callout>
        )}

        <BasicsSection form={form} />
        <StageTeamSection form={form} />
        <NeedsSection form={form} />
        <EditorSection
          id="section-media"
          title={t('projects.sections.media')}
          intro={t('projects.sections.mediaIntro')}
        >
          <ImageField project={project} userId={userId} />
          <DocumentField project={project} userId={userId} />
        </EditorSection>
        <LinksSection form={form} />

        <div
          className={cn(
            panel,
            'flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between',
          )}
        >
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
