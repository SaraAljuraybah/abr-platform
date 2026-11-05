import { OTHER } from '@shared/interest-options';
import { ExternalLink, FolderPlus, Rocket } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { StudentDashboard } from '../api';
import type { NextStep } from '../next-step';

/** A titled dashboard section; the title is an h2 that names the region. */
export function Card({
  id,
  title,
  action,
  children,
  className,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('rounded-lg border border-border bg-card p-6 shadow-sm', className)}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="text-lg font-bold text-brand">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CreateProjectButton() {
  const { t } = useTranslation();
  return (
    <Button asChild>
      <Link to="/app/projects/new">{t('dashboard.createProject')}</Link>
    </Button>
  );
}

/** One case per NextStep; the exhaustive switch makes a new state a compile error until handled. */
export function WhatsNextCard({ step }: { step: NextStep }) {
  const { t } = useTranslation();
  let body: ReactNode;
  switch (step.kind) {
    case 'none':
      body = (
        <div className="flex flex-col items-start gap-3">
          <Rocket aria-hidden="true" strokeWidth={1.75} className="size-6 text-primary" />
          <h3 className="font-bold text-foreground">{t('dashboard.next.none.title')}</h3>
          <p className="text-muted-foreground">{t('dashboard.next.none.body')}</p>
          <CreateProjectButton />
        </div>
      );
      break;
    // Pages 6–8 (SCRUM-17+) render these states.
    case 'draft':
    case 'pending_review':
    case 'changes_requested':
    case 'published':
      body = null;
      break;
    default: {
      const unreachable: never = step;
      body = unreachable;
    }
  }
  return (
    <Card id="whats-next" title={t('dashboard.next.title')} className="border-primary/30">
      {body}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
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
          <span dir="auto">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ProfileCard({ profile }: { profile: StudentDashboard }) {
  const { t } = useTranslation();
  const none = <span className="text-muted-foreground">{t('dashboard.profile.notSet')}</span>;
  // Labels of stored codes; the keys are built from database values, so they are not literal types.
  const label = (key: string): string => t(key as never);

  const major =
    profile.major === OTHER
      ? profile.majorOther
      : profile.major
        ? label(`forms.interest.options.field_of_study.${profile.major}`)
        : null;
  const level = profile.academicLevel
    ? label(`onboarding.options.academicLevel.${profile.academicLevel}`)
    : null;
  const year =
    profile.graduationYear === '2027_or_later'
      ? t('forms.interest.options.graduation_year.2027_or_later')
      : profile.graduationYear;
  const interests = profile.interests.map((code) => label(`onboarding.options.interest.${code}`));

  return (
    <Card
      id="your-profile"
      title={t('dashboard.profile.title')}
      action={
        <Link
          to="/app/profile"
          className="rounded-sm text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          {t('dashboard.profile.edit')}
        </Link>
      }
    >
      <dl className="flex flex-col gap-3">
        <Row label={t('onboarding.about.university')}>{profile.universityName ?? none}</Row>
        <Row label={t('onboarding.studies.major')}>{major ?? none}</Row>
        <Row label={t('onboarding.studies.academicLevel')}>{level ?? none}</Row>
        <Row label={t('onboarding.studies.graduationYear')}>{year ?? none}</Row>
        <Row label={t('dashboard.profile.skills')}>
          {profile.skills.length > 0 ? (
            <Chips items={profile.skills} label={t('dashboard.profile.skills')} />
          ) : (
            none
          )}
        </Row>
        <Row label={t('dashboard.profile.interests')}>
          {interests.length > 0 ? (
            <Chips items={interests} label={t('dashboard.profile.interests')} />
          ) : (
            none
          )}
        </Row>
        <Row label={t('dashboard.profile.github')}>
          {profile.githubUrl ? (
            <a
              href={profile.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="inline-flex items-center gap-1 rounded-sm font-semibold break-all text-primary underline-offset-4 hover:underline"
            >
              {profile.githubUrl.replace(/^https:\/\/(www\.)?/, '')}
              <ExternalLink aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
              {/* A separate space: one inside the hidden span is dropped from the name. */}{' '}
              <span className="sr-only">{t('dashboard.opensInNewTab')}</span>
            </a>
          ) : (
            none
          )}
        </Row>
      </dl>
    </Card>
  );
}

export function ProjectsCard() {
  const { t } = useTranslation();
  return (
    <Card id="your-projects" title={t('dashboard.projects.title')}>
      <EmptyState icon={FolderPlus} action={<CreateProjectButton />}>
        {t('dashboard.projects.empty')}
      </EmptyState>
    </Card>
  );
}
