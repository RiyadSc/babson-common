import { expect, it, vi, beforeEach } from 'vitest';
const { signInWithOtp } = vi.hoisted(() => ({ signInWithOtp: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  serverClient: async () => ({ auth: { signInWithOtp } }),
}));
vi.mock('@/lib/env', () => ({ appUrl: () => 'https://common.example' }));
import { signIn } from '@/app/actions';
beforeEach(() => {
  signInWithOtp.mockReset();
  signInWithOtp.mockResolvedValue({ error: null });
});
it('rejects non-Babson addresses without contacting the provider', async () => {
  expect(await signIn('person@gmail.com', 'signup')).toHaveProperty('error');
  expect(signInWithOtp).not.toHaveBeenCalled();
});
it('login cannot silently create an account; signup can create one', async () => {
  await signIn('STUDENT@babson.edu', 'login');
  expect(signInWithOtp).toHaveBeenLastCalledWith({
    email: 'student@babson.edu',
    options: {
      emailRedirectTo: 'https://common.example/auth/callback?next=%2Fapp',
      shouldCreateUser: false,
    },
  });
  await signIn('student@babson.edu', 'signup');
  expect(signInWithOtp).toHaveBeenLastCalledWith({
    email: 'student@babson.edu',
    options: {
      emailRedirectTo: 'https://common.example/auth/callback?next=%2Fapp',
      shouldCreateUser: true,
    },
  });
  await signIn('student@babson.edu', 'login', '/events/123');
  expect(signInWithOtp).toHaveBeenLastCalledWith({
    email: 'student@babson.edu',
    options: {
      emailRedirectTo: 'https://common.example/auth/callback?next=%2Fevents%2F123',
      shouldCreateUser: false,
    },
  });
  await signIn('student@babson.edu', 'login', '//malicious.example');
  expect(signInWithOtp).toHaveBeenLastCalledWith({
    email: 'student@babson.edu',
    options: {
      emailRedirectTo: 'https://common.example/auth/callback?next=%2Fapp',
      shouldCreateUser: false,
    },
  });
});
