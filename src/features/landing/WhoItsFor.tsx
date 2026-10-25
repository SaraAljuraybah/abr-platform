import { ArrowRight, Building2, Check, Clock, GraduationCap, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { SectionHeader } from './SectionHeader';

/** `role` is read by sign-up (SCRUM-13) to pre-select the account type. */
const AUDIENCES = [
  {
    key: 'students',
    role: 'student',
    icon: GraduationCap,
    points: [
      'landing.who.students.points.publish',
      'landing.who.students.points.requests',
      'landing.who.students.points.control',
    ],
  },
  {
    key: 'organizations',
    role: 'organization',
    icon: Building2,
    points: [
      'landing.who.organizations.points.browse',
      'landing.who.organizations.points.verified',
      'landing.who.organizations.points.requests',
    ],
  },
  {
    key: 'mentors',
    role: 'mentor',
    icon: UserRound,
    points: [
      'landing.who.mentors.points.profile',
      'landing.who.mentors.points.requests',
      'landing.who.mentors.points.contact',
    ],
  },
] as const;

export function WhoItsFor() {
  const { t } = useTranslation();
  const { session } = useAuth();

  return (
    <section id="who-its-for" aria-labelledby="who-title" className="scroll-mt-20 py-10 lg:py-16">
      <div className="container-page">
        <SectionHeader section="who" titleId="who-title" />
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map(({ key, role, icon: Icon, points }) => (
            // The card is not a link; only its action is. The lift is motion-safe only.
            <li
              key={key}
              className="flex flex-col rounded-lg border border-border bg-card p-6 transition-[translate,box-shadow] duration-200 hover:shadow-md motion-safe:hover:-translate-y-0.5"
            >
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-lg bg-muted text-primary"
              >
                <Icon className="size-7" strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 text-xl font-semibold text-brand">
                {t(`landing.who.${key}.title`)}
              </h3>
              <ul className="mt-4 flex-1 space-y-3">
                {points.map((point) => (
                  <li key={point} className="flex gap-2">
                    <Check
                      aria-hidden="true"
                      strokeWidth={2}
                      className="mt-1 size-4 shrink-0 text-success"
                    />
                    <span>{t(point)}</span>
                  </li>
                ))}
              </ul>
              {key === 'mentors' && (
                <p className="mt-4 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium text-brand">
                  <Clock
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4 shrink-0 text-primary"
                  />
                  {t('landing.who.mentors.note')}
                </p>
              )}
              {/* Signed-in visitors already have an account: no join link (UX only). */}
              {!session && (
                <Link
                  to={`/sign-up?role=${role}`}
                  className="mt-6 inline-flex items-center gap-1.5 self-start rounded-sm font-semibold text-primary hover:underline"
                >
                  {t(`landing.who.${key}.cta`)}
                  <ArrowRight
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4 rtl:-scale-x-100"
                  />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
