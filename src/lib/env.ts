export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured');
  new URL(url);
  return { url, key };
}
export function appUrl() {
  const url = process.env.APP_URL || 'http://localhost:3000';
  new URL(url);
  return url.replace(/\/$/, '');
}
