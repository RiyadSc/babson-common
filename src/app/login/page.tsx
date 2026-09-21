import AuthScreen from '@/components/auth-screen';
import { configured } from '@/lib/env';
import { redirectIfSignedIn } from '@/lib/auth-navigation';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const returnTo =
    params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : '/app';
  await redirectIfSignedIn(returnTo);
  return (
    <AuthScreen
      mode="login"
      available={configured()}
      callbackError={params.auth_error === '1'}
      returnTo={returnTo}
    />
  );
}
