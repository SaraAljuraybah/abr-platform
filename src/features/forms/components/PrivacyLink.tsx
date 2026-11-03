import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { linkClass } from '../styles';

export const PRIVACY_PATH = '/privacy';

/** The privacy notice link used in consent lines (<privacyLink> in the copy). Same tab. */
export function PrivacyLink({ children }: { children?: ReactNode }) {
  return (
    <Link to={PRIVACY_PATH} className={linkClass}>
      {children}
    </Link>
  );
}
