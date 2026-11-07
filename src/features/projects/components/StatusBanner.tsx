import { CircleAlert, CircleCheck, CircleX, Clock, EyeOff, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
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
import { toastStore } from '@/components/ui/toast-store';
import { formatLegalDate } from '@/features/legal/format';
import { useDirection } from '@/hooks/useDirection';
import { cn } from '@/lib/utils';
import { type Project, useLatestReview, useWithdrawSubmission } from '../api';
import type { ProjectStatus } from '../options';

type BannerStatus = Exclude<ProjectStatus, 'draft'>;

const STYLES: Record<BannerStatus, { icon: LucideIcon; className: string }> = {
  pending_review: { icon: Clock, className: 'border-info/30 bg-info-bg text-info' },
  changes_requested: { icon: CircleAlert, className: 'border-error/30 bg-error-bg text-error' },
  rejected: { icon: CircleX, className: 'border-error/30 bg-error-bg text-error' },
  published: { icon: CircleCheck, className: 'border-success/30 bg-success-bg text-success' },
  unpublished: { icon: EyeOff, className: 'border-border bg-muted text-foreground' },
};

/** The latest review's notes (user content: plain text, its own direction, line breaks kept). */
function ReviewNotes({ projectId, label }: { projectId: string; label: string }) {
  const { language } = useDirection();
  const review = useLatestReview(projectId, true);
  if (!review.data?.notes) return null;
  return (
    <div className="mt-3 rounded-md border border-current/20 bg-card px-3 py-2 text-foreground">
      <p className="text-sm font-semibold">
        {label}{' '}
        <span className="font-normal text-muted-foreground">
          · {formatLegalDate(review.data.createdAt.slice(0, 10), language)}
        </span>
      </p>
      <p dir="auto" className="mt-1 text-sm whitespace-pre-line">
        {review.data.notes}
      </p>
    </div>
  );
}

function WithdrawButton({ project, userId }: { project: Project; userId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const withdraw = useWithdrawSubmission(project.id, userId);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) withdraw.reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="mt-3">
          {t('projects.status.withdraw')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>{t('projects.status.withdrawTitle')}</DialogTitle>
        <DialogDescription>{t('projects.status.withdrawBody')}</DialogDescription>
        {withdraw.error && (
          <Callout variant="error" live>
            <p>{t(`projects.errors.${withdraw.error.kind}`)}</p>
          </Callout>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={withdraw.isPending}>
              {t('projects.delete.cancel')}
            </Button>
          </DialogClose>
          <Button
            type="button"
            loading={withdraw.isPending}
            loadingText={t('projects.status.withdrawing')}
            onClick={() => {
              withdraw.mutate(undefined, {
                onSuccess: () => {
                  setOpen(false);
                  toastStore.show(t('projects.status.withdrawn'));
                },
              });
            }}
          >
            {t('projects.status.withdraw')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * What the project's status means for the student, at the top of the page. Every status except
 * draft has one. Read-only states also say that editing is locked; "pending review" offers
 * withdrawing; "changes requested" and "rejected" show the latest review notes.
 */
export function StatusBanner({ project, userId }: { project: Project; userId: string }) {
  const { t } = useTranslation();
  if (project.status === 'draft') return null;
  const status = project.status;
  const { icon: Icon, className } = STYLES[status];
  const locked = status !== 'changes_requested';

  return (
    <section
      aria-labelledby="status-banner"
      className={cn('mt-6 flex max-w-3xl items-start gap-3 rounded-md border px-4 py-3', className)}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id="status-banner" className="font-bold">
          {t(`projects.status.${status}.title`)}
        </h2>
        <p className="mt-1 text-sm text-foreground">{t(`projects.status.${status}.body`)}</p>
        {locked && <p className="mt-1 text-sm text-foreground">{t('projects.readOnly.notice')}</p>}
        {(status === 'changes_requested' || status === 'rejected') && (
          <ReviewNotes
            projectId={project.id}
            label={status === 'rejected' ? t('projects.status.reason') : t('projects.status.notes')}
          />
        )}
        {status === 'pending_review' && <WithdrawButton project={project} userId={userId} />}
      </div>
    </section>
  );
}
