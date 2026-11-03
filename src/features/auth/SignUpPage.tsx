import { Navigate } from 'react-router';
import { LoadingScreen } from '@/routes/guards/LoadingScreen';
import { useAuth } from './auth-context';
import { SignUpForm } from './components/SignUpForm';

/** /sign-up. A signed-in visitor already has an account and goes to /app (UX only). */
export function SignUpPage() {
  const { status, session } = useAuth();

  if (status === 'loading') return <LoadingScreen />;
  if (session) return <Navigate to="/app" replace />;
  return <SignUpForm />;
}
