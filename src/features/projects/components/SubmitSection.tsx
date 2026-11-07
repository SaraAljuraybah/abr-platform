import { CircleAlert, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
import { linkClass } from '@/features/forms/styles';
import type { ProjectFailure } from '../api';
import {
  DESCRIPTION_MIN,
  missingForSubmit,
  REQUIRED_FORM_FIELD,
  type RequiredField,
} from '../options';
import type { ProjectValues } from '../schemas';
import { EditorSection } from './EditorSections';

interface SubmitSectionProps {
  form: UseFormReturn<ProjectValues>;
  resubmit: boolean;
  /** Saves open changes (when the form is dirty), then submits. Rejects on any failure. */
  onSubmit: () => Promise<void>;
  pending: boolean;
  error: ProjectFailure | null;
  onOpen: () => void;
}

/**
 * The checklist of what submit_project() still needs (same rule, on the form's current values) and
 * "Submit for review" behind a confirmation. A server refusal for missing fields (say, a change in
 * another tab) is shown as the same checklist.
 */
export function SubmitSection({
  form,
  resubmit,
  onSubmit,
  pending,
  error,
  onOpen,
}: SubmitSectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const values = useWatch({ control: form.control });
  const missing = missingForSubmit({
    title: values.title ?? '',
    summary: values.summary ?? '',
    description: values.description ?? '',
    track: values.track ?? '',
    academicYear: values.academicYear ?? '',
    stage: values.stage ?? '',
  });
  const serverMissing = error?.kind === 'incomplete' ? error.missing : [];
  const shown = missing.length > 0 ? missing : serverMissing;
  const label = (field: RequiredField) =>
    field === 'description'
      ? t('projects.submit.descriptionItem', { min: DESCRIPTION_MIN })
      : field === 'academic_year'
        ? t('projects.fields.academicYear')
        : t(`projects.fields.${field}`);
  const action = resubmit ? t('projects.submit.resubmit') : t('projects.submit.button');

  return (
    <EditorSection
      id="section-submit"
      title={resubmit ? t('projects.submit.resubmitTitle') : t('projects.submit.title')}
      intro={t('projects.submit.intro')}
    >
      {shown.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-foreground">{t('projects.submit.checklist')}</p>
          <ul className="flex flex-col gap-1.5">
            {shown.map((field) => (
              <li key={field} className="flex items-center gap-2 text-sm">
                <CircleAlert
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 shrink-0 text-error"
                />
                <span className="sr-only">{t('projects.submit.missing')} </span>
                <button
                  type="button"
                  className={linkClass}
                  onClick={() => {
                    form.setFocus(REQUIRED_FORM_FIELD[field], { shouldSelect: false });
                  }}
                >
                  {label(field)}
                </button>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{t('projects.submit.completeFirst')}</p>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-success">
          <CircleCheck aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {t('projects.submit.ready')}
        </p>
      )}

      {error && error.kind !== 'incomplete' && (
        <Callout variant="error" live>
          <p>{t(`projects.errors.${error.kind}`)}</p>
        </Callout>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) onOpen();
          setOpen(next);
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" disabled={missing.length > 0} className="self-start">
            {action}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>{t('projects.submit.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('projects.submit.dialogBody')}</DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                {t('projects.delete.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="button"
              loading={pending}
              loadingText={t('projects.submit.submitting')}
              onClick={() => {
                onSubmit().then(
                  () => {
                    setOpen(false);
                  },
                  () => {
                    // The reason shows in the section (checklist or error).
                    setOpen(false);
                  },
                );
              }}
            >
              {action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EditorSection>
  );
}
