import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Callout } from '@/components/ui/callout';
import { linkClass } from '@/features/forms/styles';
import { cn } from '@/lib/utils';
import type { Project } from '../api';
import { page, panel } from '../styles';
import { useOptionLabels } from './labels';
import { DocumentSummary } from './MediaSection';
import { ProjectImage } from './ProjectImage';
import { ProjectStatusChip } from './ProjectStatusChip';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 whitespace-pre-line text-foreground">{children}</dd>
    </div>
  );
}

function Chips({ items, label }: { items: string[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-0.5 text-sm"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function ExternalUrl({ href }: { href: string }) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      dir="ltr"
      className={`${linkClass} inline-flex items-center gap-1 break-all`}
    >
      {href.replace(/^https:\/\/(www\.)?/, '')}
      <ExternalLink aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />{' '}
      <span className="sr-only">{t('legal.opensInNewTab')}</span>
    </a>
  );
}

/** Any status the owner cannot edit in: what was submitted, with a note on why it is locked. */
export function ProjectReadOnly({ project }: { project: Project }) {
  const { t } = useTranslation();
  const labels = useOptionLabels();
  const none = <span className="text-muted-foreground">{t('projects.notSet')}</span>;
  const chips = (codes: string[], label: string, toLabel: (code: string) => string) =>
    codes.length > 0 ? <Chips items={codes.map(toLabel)} label={label} /> : none;

  return (
    <div className={page}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="auth-title text-brand">{t('projects.readOnly.title')}</h1>
        <ProjectStatusChip status={project.status} />
      </div>
      <Callout className="mt-6 max-w-3xl">
        <p>{t('projects.readOnly.notice')}</p>
      </Callout>
      <div className={cn(panel, 'mt-6 flex max-w-3xl flex-col gap-6')}>
        <ProjectImage project={project} size="lg" />
        <dl className="flex flex-col gap-4">
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
            {chips(project.sectors, t('projects.fields.sectors'), labels.sector)}
          </Row>
          <Row label={t('projects.fields.academicYear')}>
            {project.academicYear ? labels.year(project.academicYear) : none}
          </Row>
          <Row label={t('projects.fields.stage')}>
            {project.stage ? labels.stage(project.stage) : none}
          </Row>
          <Row label={t('projects.fields.teamSize')}>{project.teamSize}</Row>
          <Row label={t('projects.fields.lookingForMembers')}>
            {project.lookingForMembers ? t('projects.yes') : t('projects.no')}
          </Row>
          {project.lookingForMembers && (
            <Row label={t('projects.fields.wantedSpecializations')}>
              {chips(
                project.wantedSpecializations,
                t('projects.fields.wantedSpecializations'),
                labels.specialization,
              )}
            </Row>
          )}
          <Row label={t('projects.fields.needs')}>
            {chips(project.needs, t('projects.fields.needs'), labels.need)}
          </Row>
          <Row label={t('projects.media.document')}>
            {project.documentPath ? <DocumentSummary path={project.documentPath} /> : none}
          </Row>
          <Row label={t('projects.fields.videoUrl')}>
            {project.videoUrl ? <ExternalUrl href={project.videoUrl} /> : none}
          </Row>
          <Row label={t('projects.fields.repoUrl')}>
            {project.repoUrl ? <ExternalUrl href={project.repoUrl} /> : none}
          </Row>
          <Row label={t('projects.fields.demoUrl')}>
            {project.demoUrl ? <ExternalUrl href={project.demoUrl} /> : none}
          </Row>
        </dl>
      </div>
    </div>
  );
}
