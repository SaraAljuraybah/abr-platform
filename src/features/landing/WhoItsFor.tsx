import { ArrowRight, Building2, Check, Clock, GraduationCap, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';

const AUDIENCES = [
  {
    key: 'students',
    icon: GraduationCap,
    points: [
      'landing.who.students.points.publish',
      'landing.who.students.points.requests',
      'landing.who.students.points.control',
    ],
  },
  {
    key: 'organizations',
    icon: Building2,
    points: [
      'landing.who.organizations.points.browse',
      'landing.who.organizations.points.verified',
      'landing.who.organizations.points.requests',
    ],
  },
  {
    key: 'mentors',
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
    <section
      id="who-its-for"
      aria-labelledby="who-title"
      className="scroll-mt-20 border-t border-border py-16 lg:py-24"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <h2 id="who-title" className="max-w-3xl text-brand">
          {t('landing.who.title')}
        </h2>
        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {AUDIENCES.map(({ key, icon: Icon, points }) => (
            <li key={key} className="flex flex-col rounded-lg border border-border bg-card p-6">
              <span
                aria-hidden="true"
                className="flex size-12 items-center justify-center rounded-md bg-muted text-primary"
              >
                <Icon className="size-6" strokeWidth={1.75} />
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
                <p className="mt-4 flex items-center gap-2 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
                  <Clock aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
                  {t('landing.who.mentors.note')}
                </p>
              )}
              {/* Signed-in visitors already have an account: no sign-up link (UX only). */}
              {!session && (
                <Link
                  to="/sign-up"
                  className="mt-6 inline-flex items-center gap-1.5 self-start rounded-sm font-semibold text-primary hover:underline"
                >
                  {t('landing.who.cta')}
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
