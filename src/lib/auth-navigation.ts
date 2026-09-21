import 'server-only';
import { redirect } from 'next/navigation';
import { configured } from './env';
import { studentClient } from './supabase/server';
export async function verifiedSession() {
  if (!configured()) return null;
  try {
    return await studentClient();
  } catch {
    return null;
  }
}
export async function redirectIfSignedIn(destination = '/app') {
  if (await verifiedSession()) redirect(destination);
}
