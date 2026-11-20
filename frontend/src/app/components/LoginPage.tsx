import { Navigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useAuth } from '../../lib/auth';

const ERRORS: Record<string, string> = {
  forbidden: 'That Google account is not on the list of administrators.',
  google: 'Google sign-in failed. Try again.',
  cancelled: 'Sign-in was cancelled.',
};

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const error = params.get('error');

  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Kent Project Admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-600">{ERRORS[error] ?? 'Sign-in failed.'}</p>
          )}
          <Button asChild className="w-full">
            <a href="/auth/login">Sign in with Google</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
