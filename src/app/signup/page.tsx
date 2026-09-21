import AuthScreen from '@/components/auth-screen';
import { configured } from '@/lib/env';
import { redirectIfSignedIn } from '@/lib/auth-navigation';
export default async function SignupPage() {
  await redirectIfSignedIn();
  return <AuthScreen mode="signup" available={configured()} />;
}
