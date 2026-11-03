import { isAuthEnabled } from '@/lib/features';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

/** Request access leads to an account, so phase 1 launch mode shows "Coming soon" instead. */
export function RequestAccessRoute() {
  return isAuthEnabled() ? (
    <PlaceholderPage page="requestAccess" className="p-0 sm:p-0" />
  ) : (
    <ComingSoonPage />
  );
}
