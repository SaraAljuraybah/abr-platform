import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { CharacterCount } from '@/components/ui/field-number';
import { TextareaField } from '@/components/ui/textarea-field';
import { toastStore } from '@/components/ui/toast-store';
import { type ReviewDecision, useReviewProjectMutation } from '../api';

const NOTES_MAX = 2000;
const needsNotes = (decision: ReviewDecision) => decision !== 'approved';

/**
 * Approve and publish, request changes, or reject: each behind a confirmation. Notes are required
 * for the last two (checked here first, and by review_project()). A project that is no longer
 * pending (the student withdrew it) is reported and the page reloads.
 */
export function DecisionPanel({
  projectId,
  onNotPending,
}: {
  projectId: string;
  onNotPending: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const review = useReviewProjectMutation(projectId);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState(false);

  const open = (next: ReviewDecision) => {
    review.reset();
    setNotes('');
    setNotesError(false);
    setDecision(next);
  };

  const confirm = () => {
    if (!decision) return;
    if (needsNotes(decision) && notes.trim() === '') {
      setNotesError(true);
      return;
    }
    review.mutate(
      { decision, notes },
      {
        onSuccess: () => {
          toastStore.show(t(`admin.review.done.${decision}`));
          void navigate('/admin/projects');
        },
        onError: (error) => {
          if (error.kind === 'notPending') {
            setDecision(null);
            onNotPending();
          }
        },
      },
    );
  };

  return (
    <section
      aria-labelledby="decision-title"
      className="flex flex-col gap-4 rounded-lg border-2 border-primary bg-card p-5 shadow-sm"
    >
      <div>
        <h2 id="decision-title" className="text-lg font-bold text-brand">
          {t('admin.review.decisionTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.review.decisionIntro')}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => {
            open('approved');
          }}
        >
          {t('admin.review.approve')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            open('changes_requested');
          }}
        >
          {t('admin.review.requestChanges')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="text-error"
          onClick={() => {
            open('rejected');
          }}
        >
          {t('admin.review.reject')}
        </Button>
      </div>

      <Dialog
        open={decision !== null}
        onOpenChange={(next) => {
          if (!next) setDecision(null);
        }}
      >
        {decision && (
          <DialogContent>
            <DialogTitle>{t(`admin.review.dialog.${decision}.title`)}</DialogTitle>
            <DialogDescription>{t(`admin.review.dialog.${decision}.body`)}</DialogDescription>
            <TextareaField
              label={
                needsNotes(decision) ? t('admin.review.notes') : t('admin.review.notesOptional')
              }
              rows={5}
              maxLength={NOTES_MAX}
              value={notes}
              required={needsNotes(decision)}
              error={notesError ? t('admin.review.notesRequired') : undefined}
              details={<CharacterCount value={notes.length} max={NOTES_MAX} />}
              onChange={(event) => {
                setNotes(event.target.value);
                if (notesError) setNotesError(false);
              }}
            />
            {review.error && review.error.kind !== 'notPending' && (
              <Callout variant="error" live>
                <p>
                  {review.error.kind === 'notesRequired'
                    ? t('admin.review.notesRequired')
                    : review.error.kind === 'network'
                      ? t('projects.errors.network')
                      : t('projects.errors.unexpected')}
                </p>
              </Callout>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={review.isPending}>
                  {t('admin.review.cancel')}
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant={decision === 'rejected' ? 'destructive' : 'default'}
                loading={review.isPending}
                loadingText={t('admin.review.saving')}
                onClick={confirm}
              >
                {t(`admin.review.dialog.${decision}.confirm`)}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
