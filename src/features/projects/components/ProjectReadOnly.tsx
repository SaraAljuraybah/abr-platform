import { useTranslation } from 'react-i18next';
import type { Project } from '../api';
import { page } from '../styles';
import { ProjectDetails } from './ProjectDetails';
import { ProjectStatusChip } from './ProjectStatusChip';
import { StatusBanner } from './StatusBanner';

/** Any status the owner cannot edit in: what was submitted, with what the status means. */
export function ProjectReadOnly({ project, userId }: { project: Project; userId: string }) {
  const { t } = useTranslation();
  return (
    <div className={page}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="auth-title text-brand">{t('projects.readOnly.title')}</h1>
        <ProjectStatusChip status={project.status} />
      </div>
      <StatusBanner project={project} userId={userId} />
      <ProjectDetails project={project} className="mt-6" />
    </div>
  );
}
