import { Navigate, useSearchParams } from 'react-router';
import { LoadingScreen } from '@/routes/guards/LoadingScreen';
import { useAuth } from './auth-context';
import { SignInForm } from './components/SignInForm';
import { safeNext } from './safe-redirect';

/**
 * /sign-in. One redirect path for both cases (already signed in, or just signed in through
 * onAuthStateChange): a safe in-app `next`, otherwise /app. UX only; the database is the authority.
 */
export function SignInPage() {
  const { status, session } = useAuth();
  const [params] = useSearchParams();

  if (status === 'loading') return <LoadingScreen />;
  if (session) return <Navigate to={safeNext(params.get('next'))} replace />;
  return <SignInForm />;
}
