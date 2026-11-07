import { ExternalLink, FileText } from 'lucide-react';
import { type ReactNode, type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { linkClass } from '@/features/forms/styles';
import {
  type FileErrorKind,
  type Project,
  useFileInfo,
  useProjectFile,
  useSignedUrl,
} from '../api';
import { PROJECT_FILES, type ProjectFileKind } from '../options';
import type { PreparedFile } from '../storage';
import { useFileSize } from './labels';
import { ProjectImage } from './ProjectImage';

/** The message for a failed upload or removal, specific to the kind of file where it matters. */
function useFileError() {
  const { t } = useTranslation();
  return (kind: ProjectFileKind, error: FileErrorKind) => {
    switch (error) {
      case 'wrongType':
        return kind === 'image'
          ? t('projects.media.errors.wrongTypeImage')
          : t('projects.media.errors.wrongTypeDocument');
      case 'tooLarge':
        return kind === 'image'
          ? t('projects.media.errors.tooLargeImage')
          : t('projects.media.errors.tooLargeDocument');
      case 'network':
        return t('projects.media.errors.network');
      case 'notAllowed':
      case 'notEditable':
        return t('projects.errors.notEditable');
      case 'unexpected':
        return t('projects.errors.unexpected');
    }
  };
}

function Progress({ label, percent }: { label: string; percent: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${String(percent)}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{t('projects.media.uploading', { percent })}</p>
    </div>
  );
}

interface FileFieldProps {
  project: Project;
  userId: string;
}

/** A checked (and, for an image, re-encoded) file waiting for the student's confirmation. */
interface Pending {
  prepared: PreparedFile;
  /** Images: an object URL of the re-encoded blob, i.e. exactly what will be stored. */
  url: string | null;
}

/** Longest side over shortest side above this counts as very wide or very tall. */
const SQUARE_TIP_RATIO = 4 / 3;

/**
 * Upload, replace or remove one file. Choosing a file only prepares it (checks and, for an image,
 * re-encoding in the browser): nothing is sent until the student confirms in the dialog. Saves
 * immediately once confirmed; never part of the form's Save.
 */
function useFileField(
  project: Project,
  kind: ProjectFileKind,
  userId: string,
  inputRef: RefObject<HTMLInputElement | null>,
) {
  const file = useProjectFile(project, kind, userId);
  const [done, setDone] = useState<'uploaded' | 'removed' | null>(null);
  const [pending, setPendingState] = useState<Pending | null>(null);
  // Mirrors the state, so each object URL is revoked exactly once.
  const pendingRef = useRef<Pending | null>(null);
  const busy = file.prepare.isPending || file.upload.isPending || file.remove.isPending;
  const error = file.prepare.error ?? file.upload.error ?? file.remove.error;

  const setPending = (next: Pending | null) => {
    const previous = pendingRef.current;
    if (previous?.url) URL.revokeObjectURL(previous.url);
    pendingRef.current = next;
    setPendingState(next);
  };
  useEffect(() => {
    const holder = pendingRef;
    return () => {
      if (holder.current?.url) URL.revokeObjectURL(holder.current.url);
      holder.current = null;
    };
  }, []);

  const choose = () => {
    inputRef.current?.click();
  };
  const onFile = (selected: File | undefined, input: HTMLInputElement) => {
    // The same file can be chosen again after an error or a cancel.
    input.value = '';
    if (!selected) return;
    setDone(null);
    file.remove.reset();
    file.upload.reset();
    file.prepare.mutate(selected, {
      onSuccess: (prepared) => {
        setPending({
          prepared,
          url: kind === 'image' ? URL.createObjectURL(prepared.blob) : null,
        });
      },
    });
  };
  const confirm = () => {
    if (!pending || file.upload.isPending) return;
    file.upload.mutate(pending.prepared, {
      onSuccess: () => {
        setPending(null);
        setDone('uploaded');
      },
    });
  };
  /** Closes the dialog without uploading; the current file stays. Not while an upload runs. */
  const cancel = () => {
    if (file.upload.isPending) return;
    setPending(null);
    file.prepare.reset();
    file.upload.reset();
  };
  const remove = () => {
    setDone(null);
    file.prepare.reset();
    file.upload.reset();
    file.remove.mutate(undefined, {
      onSuccess: () => {
        setDone('removed');
      },
    });
  };
  return { ...file, choose, onFile, confirm, cancel, remove, pending, busy, error, done };
}

type Field = ReturnType<typeof useFileField>;

function HiddenInput({
  ref,
  kind,
  label,
  onFile,
}: {
  ref: Ref<HTMLInputElement>;
  kind: ProjectFileKind;
  label: string;
  onFile: Field['onFile'];
}) {
  return (
    // Opened by a visible button; kept out of the tab order and the accessibility tree.
    <input
      ref={ref}
      type="file"
      accept={PROJECT_FILES[kind].types.join(',')}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      aria-label={label}
      onChange={(event) => {
        onFile(event.target.files?.[0], event.target);
      }}
    />
  );
}

/**
 * The confirmation dialog shared by both files. Focus is trapped; Escape, a click outside and
 * Cancel upload nothing, and focus returns to the Upload/Replace button. While the upload runs it
 * cannot be dismissed, and it shows the progress bar.
 */
function ConfirmDialog({
  field,
  kind,
  title,
  description,
  confirmLabel,
  progressLabel,
  trigger,
  children,
  extraAction,
}: {
  field: Field;
  kind: ProjectFileKind;
  title: string;
  description: string;
  confirmLabel: string;
  progressLabel: string;
  trigger: RefObject<HTMLButtonElement | null>;
  children?: ReactNode;
  extraAction?: ReactNode;
}) {
  const { t } = useTranslation();
  const message = useFileError();
  const uploading = field.upload.isPending;
  const block = (event: Event) => {
    if (uploading) event.preventDefault();
  };
  return (
    <Dialog
      open={field.pending !== null}
      onOpenChange={(open) => {
        if (!open) field.cancel();
      }}
    >
      <DialogContent
        className="max-w-lg"
        onEscapeKeyDown={block}
        onInteractOutside={block}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
        {field.progress !== null && <Progress label={progressLabel} percent={field.progress} />}
        {field.error && (
          <Callout variant="error" live>
            <p>{message(kind, field.error.kind)}</p>
          </Callout>
        )}
        <DialogFooter>
          {extraAction}
          <Button type="button" variant="outline" disabled={uploading} onClick={field.cancel}>
            {t('projects.media.cancel')}
          </Button>
          <Button
            type="button"
            loading={uploading}
            loadingText={t('projects.media.uploadingShort')}
            disabled={field.prepare.isPending}
            onClick={field.confirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The re-encoded image as the app will show it: the same ProjectImage, large and small. */
function ImagePreview({ project, pending }: { project: Project; pending: Pending }) {
  const { t } = useTranslation();
  const fileSize = useFileSize();
  const { width, height, blob } = pending.prepared;
  const src = pending.url ?? undefined;
  const long = Math.max(width ?? 1, height ?? 1);
  const short = Math.max(1, Math.min(width ?? 1, height ?? 1));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-6">
        <figure className="flex flex-col gap-1.5">
          <ProjectImage project={project} size="lg" src={src} />
          <figcaption className="text-sm text-muted-foreground">
            {t('projects.media.previewLarge')}
          </figcaption>
        </figure>
        <figure className="flex flex-col gap-1.5">
          <ProjectImage project={project} size="sm" src={src} />
          <figcaption className="text-sm text-muted-foreground">
            {t('projects.media.previewSmall')}
          </figcaption>
        </figure>
      </div>
      <p className="text-sm font-semibold text-foreground" data-testid="preview-size">
        {width !== undefined && height !== undefined
          ? t('projects.media.previewSize', {
              width: String(width),
              height: String(height),
              size: fileSize(blob.size),
            })
          : fileSize(blob.size)}
      </p>
      {long / short > SQUARE_TIP_RATIO && (
        <p className="text-sm text-muted-foreground">{t('projects.media.previewSquareTip')}</p>
      )}
    </div>
  );
}

/** Name and size of a document (stored, or waiting for confirmation). */
function DocumentRow({ name, size, action }: { name: string; size?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
      <FileText aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p dir="auto" className="truncate text-sm font-semibold text-foreground">
          {name}
        </p>
        {size && <p className="text-sm text-muted-foreground">{size}</p>}
      </div>
      {action}
    </div>
  );
}

export function ImageField({ project, userId }: FileFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const againRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const field = useFileField(project, 'image', userId, inputRef);
  const message = useFileError();
  const has = project.imagePath !== null;
  const label = t('projects.media.image');

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <ProjectImage project={project} size="lg" />
      <div className="flex min-w-0 flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground">{t('projects.media.imageHint')}</p>
        </div>
        <HiddenInput ref={inputRef} kind="image" label={label} onFile={field.onFile} />
        <div className="flex flex-wrap gap-2">
          <Button
            ref={triggerRef}
            type="button"
            variant="outline"
            loading={field.prepare.isPending && field.pending === null}
            loadingText={t('projects.media.preparing')}
            disabled={field.busy}
            onClick={field.choose}
          >
            {has ? t('projects.media.replaceImage') : t('projects.media.uploadImage')}
          </Button>
          {has && (
            <Button
              type="button"
              variant="outline"
              className="text-error"
              disabled={field.busy}
              onClick={field.remove}
            >
              {t('projects.media.removeImage')}
            </Button>
          )}
        </div>
        {field.error && field.pending === null && (
          <Callout variant="error" live>
            <p>{message('image', field.error.kind)}</p>
          </Callout>
        )}
        <p role="status" className="text-sm text-success">
          {field.done === 'uploaded' && t('projects.media.imageUploaded')}
          {field.done === 'removed' && t('projects.media.imageRemoved')}
        </p>
      </div>
      <ConfirmDialog
        field={field}
        kind="image"
        title={t('projects.media.previewTitle')}
        description={t('projects.media.previewBody')}
        confirmLabel={t('projects.media.useImage')}
        progressLabel={t('projects.media.uploadingImage')}
        trigger={triggerRef}
        extraAction={
          <Button
            type="button"
            variant="outline"
            className="sm:me-auto"
            loading={field.prepare.isPending}
            loadingText={t('projects.media.preparing')}
            disabled={field.upload.isPending}
            onClick={() => againRef.current?.click()}
          >
            {t('projects.media.chooseAnother')}
          </Button>
        }
      >
        {/* Inside the dialog, so the picker opens from within the focus trap. */}
        <HiddenInput
          ref={againRef}
          kind="image"
          label={t('projects.media.chooseAnother')}
          onFile={field.onFile}
        />
        {field.pending && <ImagePreview project={project} pending={field.pending} />}
      </ConfirmDialog>
    </div>
  );
}

export function DocumentField({ project, userId }: FileFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const field = useFileField(project, 'document', userId, inputRef);
  const message = useFileError();
  const fileSize = useFileSize();
  const info = useFileInfo('document', project.documentPath);
  const url = useSignedUrl('document', project.documentPath);
  const has = project.documentPath !== null;
  const label = t('projects.media.document');
  const pending = field.pending?.prepared;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <p className="text-sm text-muted-foreground">{t('projects.media.documentHint')}</p>
      </div>
      {has && (
        <DocumentRow
          name={info.data?.name ?? t('projects.media.documentFallbackName')}
          size={typeof info.data?.size === 'number' ? fileSize(info.data.size) : undefined}
          action={url.data && <OpenLink href={url.data} />}
        />
      )}
      <HiddenInput ref={inputRef} kind="document" label={label} onFile={field.onFile} />
      <div className="flex flex-wrap gap-2">
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          disabled={field.busy}
          onClick={field.choose}
        >
          {has ? t('projects.media.replaceDocument') : t('projects.media.uploadDocument')}
        </Button>
        {has && (
          <Button
            type="button"
            variant="outline"
            className="text-error"
            disabled={field.busy}
            onClick={field.remove}
          >
            {t('projects.media.removeDocument')}
          </Button>
        )}
      </div>
      {field.error && field.pending === null && (
        <Callout variant="error" live>
          <p>{message('document', field.error.kind)}</p>
        </Callout>
      )}
      <p role="status" className="text-sm text-success">
        {field.done === 'uploaded' && t('projects.media.documentUploaded')}
        {field.done === 'removed' && t('projects.media.documentRemoved')}
      </p>
      <ConfirmDialog
        field={field}
        kind="document"
        title={t('projects.media.confirmDocumentTitle')}
        description={t('projects.media.confirmDocumentBody')}
        confirmLabel={t('projects.media.confirmDocumentUpload')}
        progressLabel={t('projects.media.uploadingDocument')}
        trigger={triggerRef}
      >
        {pending && <DocumentRow name={pending.originalName} size={fileSize(pending.blob.size)} />}
      </ConfirmDialog>
    </div>
  );
}

/** "Open" for a stored document: a signed URL in a new tab. */
export function OpenLink({ href }: { href: string }) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClass} inline-flex items-center gap-1 text-sm`}
    >
      {t('projects.media.open')}
      <ExternalLink aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />{' '}
      <span className="sr-only">{t('legal.opensInNewTab')}</span>
    </a>
  );
}

/** A read-only document row (for the read-only view): name, size and "Open". */
export function DocumentSummary({ path }: { path: string }) {
  const { t } = useTranslation();
  const fileSize = useFileSize();
  const info = useFileInfo('document', path);
  const url = useSignedUrl('document', path);
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <span dir="auto">{info.data?.name ?? t('projects.media.documentFallbackName')}</span>
      {typeof info.data?.size === 'number' && (
        <span className="text-sm text-muted-foreground">{fileSize(info.data.size)}</span>
      )}
      {url.data && <OpenLink href={url.data} />}
    </span>
  );
}
