import { ExternalLink, FileText } from 'lucide-react';
import { type Ref, type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { linkClass } from '@/features/forms/styles';
import {
  type FileErrorKind,
  type Project,
  useFileInfo,
  useProjectFile,
  useSignedUrl,
} from '../api';
import { PROJECT_FILES, type ProjectFileKind } from '../options';
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

/** Upload, replace or remove one file. Saves immediately; never part of the form's Save. */
function useFileField(
  project: Project,
  kind: ProjectFileKind,
  userId: string,
  inputRef: RefObject<HTMLInputElement | null>,
) {
  const file = useProjectFile(project, kind, userId);
  const [done, setDone] = useState<'uploaded' | 'removed' | null>(null);
  const busy = file.upload.isPending || file.remove.isPending;
  const error = file.upload.error ?? file.remove.error;

  const choose = () => {
    inputRef.current?.click();
  };
  const onFile = (selected: File | undefined) => {
    if (!selected) return;
    setDone(null);
    file.remove.reset();
    file.upload.mutate(selected, {
      onSuccess: () => {
        setDone('uploaded');
      },
    });
    // The same file can be chosen again after an error.
    if (inputRef.current) inputRef.current.value = '';
  };
  const remove = () => {
    setDone(null);
    file.upload.reset();
    file.remove.mutate(undefined, {
      onSuccess: () => {
        setDone('removed');
      },
    });
  };
  return { ...file, choose, onFile, remove, busy, error, done };
}

function HiddenInput({
  ref,
  kind,
  label,
  onFile,
}: {
  ref: Ref<HTMLInputElement>;
  kind: ProjectFileKind;
  label: string;
  onFile: (file: File | undefined) => void;
}) {
  return (
    // Opened by the visible button; kept out of the tab order and the accessibility tree.
    <input
      ref={ref}
      type="file"
      accept={PROJECT_FILES[kind].types.join(',')}
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      aria-label={label}
      onChange={(event) => {
        onFile(event.target.files?.[0]);
      }}
    />
  );
}

export function ImageField({ project, userId }: FileFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
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
          <Button type="button" variant="outline" disabled={field.busy} onClick={field.choose}>
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
        {field.progress !== null && (
          <Progress label={t('projects.media.uploadingImage')} percent={field.progress} />
        )}
        {field.error && (
          <Callout variant="error" live>
            <p>{message('image', field.error.kind)}</p>
          </Callout>
        )}
        <p role="status" className="text-sm text-success">
          {field.done === 'uploaded' && t('projects.media.imageUploaded')}
          {field.done === 'removed' && t('projects.media.imageRemoved')}
        </p>
      </div>
    </div>
  );
}

export function DocumentField({ project, userId }: FileFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const field = useFileField(project, 'document', userId, inputRef);
  const message = useFileError();
  const fileSize = useFileSize();
  const info = useFileInfo('document', project.documentPath);
  const url = useSignedUrl('document', project.documentPath);
  const has = project.documentPath !== null;
  const label = t('projects.media.document');

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <p className="text-sm text-muted-foreground">{t('projects.media.documentHint')}</p>
      </div>
      {has && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <FileText
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-5 shrink-0 text-primary"
          />
          <div className="min-w-0 flex-1">
            <p dir="auto" className="truncate text-sm font-semibold text-foreground">
              {info.data?.name ?? t('projects.media.documentFallbackName')}
            </p>
            {typeof info.data?.size === 'number' && (
              <p className="text-sm text-muted-foreground">{fileSize(info.data.size)}</p>
            )}
          </div>
          {url.data && <OpenLink href={url.data} />}
        </div>
      )}
      <HiddenInput ref={inputRef} kind="document" label={label} onFile={field.onFile} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={field.busy} onClick={field.choose}>
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
      {field.progress !== null && (
        <Progress label={t('projects.media.uploadingDocument')} percent={field.progress} />
      )}
      {field.error && (
        <Callout variant="error" live>
          <p>{message('document', field.error.kind)}</p>
        </Callout>
      )}
      <p role="status" className="text-sm text-success">
        {field.done === 'uploaded' && t('projects.media.documentUploaded')}
        {field.done === 'removed' && t('projects.media.documentRemoved')}
      </p>
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
