import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { page } from '@/features/projects/styles';
import { cn } from '@/lib/utils';

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold transition-colors',
    isActive
      ? 'bg-secondary text-brand underline decoration-2 underline-offset-8'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
  );

/**
 * /admin (RequireRole admin; UX only). The admin sub-navigation above each admin page. Every
 * query and RPC behind these pages is checked again by the database (is_admin()).
 */
export function AdminLayout() {
  const { t } = useTranslation();
  return (
    <div className={page}>
      <nav aria-label={t('admin.nav.label')} className="border-b border-border pb-2">
        <ul className="flex flex-wrap gap-1">
          <li>
            <NavLink to="/admin" end className={tab}>
              {t('admin.nav.overview')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/projects" className={tab}>
              {t('admin.nav.projects')}
            </NavLink>
          </li>
          <li>
            <NavLink to="/admin/interest" className={tab}>
              {t('admin.nav.interest')}
            </NavLink>
          </li>
        </ul>
      </nav>
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  );
}
