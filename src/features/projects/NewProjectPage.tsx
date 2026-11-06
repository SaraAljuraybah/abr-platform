import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CharacterCount } from '@/components/ui/field-number';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/features/auth/auth-context';
import { validationMessage } from '@/lib/zod-i18n';
import { useCreateProject, useOwnProjects } from './api';
import { ProjectLoadError, ProjectSkeleton } from './components/states';
import { PROJECT_LIMITS, projectEditPath as editPath } from './options';
import { newProjectSchema, type NewProjectValues } from './schemas';
import { page, panel } from './styles';

/**
 * /app/projects/new (students only; UX guard). One field, then create_project() makes the draft.
 * V1 allows one project per student, so a student who has one goes straight to it. The database
 * enforces the limit and who may create; this page only follows its answer.
 */
export function NewProjectPage() {
  const { session } = useAuth();
  if (!session) return null;
  return <NewProject userId={session.user.id} />;
}

function NewProject({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projects = useOwnProjects(userId);
  const create = useCreateProject(userId);
  const errorRef = useRef<HTMLDivElement>(null);
  const form = useForm<NewProjectValues>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: { title: '' },
  });
  const titleValue = useWatch({ control: form.control, name: 'title' });

  useEffect(() => {
    if (create.error && create.error.kind !== 'limit') errorRef.current?.focus();
  }, [create.error]);

  const title = t('projects.new.title');
  if (projects.isPending) return <ProjectSkeleton title={title} />;
  if (projects.isError) {
    return (
      <ProjectLoadError
        title={title}
        retrying={projects.isRefetching}
        onRetry={() => void projects.refetch()}
      />
    );
  }

  // Also covers ABR_PROJECT_LIMIT: the refetch after the refusal finds the existing project.
  const existing = projects.data[0];
  if (existing && !create.isSuccess) return <Navigate to={editPath(existing.id)} replace />;

  const onSubmit = form.handleSubmit(({ title: value }) => {
    create.mutate(value, {
      onSuccess: (id) => void navigate(editPath(id), { replace: true }),
    });
  });

  return (
    <div className={page}>
      <h1 className="auth-title text-brand">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t('projects.new.intro')}</p>

      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className={`${panel} mt-8 flex max-w-2xl flex-col gap-6`}
      >
        {create.error && create.error.kind !== 'limit' && (
          <Callout ref={errorRef} tabIndex={-1} variant="error">
            <p>{t(`projects.errors.${create.error.kind}`)}</p>
          </Callout>
        )}
        <TextField
          label={t('projects.fields.title')}
          maxLength={PROJECT_LIMITS.title.max}
          autoComplete="off"
          error={validationMessage(t, form.formState.errors.title?.message)}
          details={<CharacterCount value={titleValue.length} max={PROJECT_LIMITS.title.max} />}
          {...form.register('title')}
        />
        <div>
          <Button type="submit" loading={create.isPending} loadingText={t('projects.new.creating')}>
            {t('projects.new.submit')}
          </Button>
        </div>
      </form>
    </div>
  );
}
