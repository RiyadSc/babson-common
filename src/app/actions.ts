'use server';
import { z } from 'zod';
import { activitySchema, isBabsonEmail } from '@/lib/domain';
import { serverClient, studentClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/env';
import { prepareScreenshot } from '@/lib/attachments';
import { normalizeInput } from '@/lib/ingestion';
export async function signIn(email: string, mode: 'login' | 'signup' = 'login', returnTo = '/app') {
  if (!isBabsonEmail(email)) return { error: 'Use your @babson.edu email address.' };
  const destination = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/app';
  const client = await serverClient();
  const { error } = await client.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(destination)}`,
      shouldCreateUser: mode === 'signup',
    },
  });
  return error ? { error: error.message } : { ok: true };
}
export async function signOut() {
  const c = await serverClient();
  await c.auth.signOut();
}
export async function loadHub() {
  const { client, user } = await studentClient();
  const results = await Promise.all([
    client.from('event_feed').select('*').order('starts_at').limit(500),
    client.from('profiles').select('*').eq('id', user.id).single(),
    client.from('attendance').select('event_id,status').eq('user_id', user.id),
    client.from('saves').select('event_id').eq('user_id', user.id),
    client.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
  ]);
  for (const r of results) if (r.error) throw new Error(r.error.message);
  const [events, profile, attendance, saves, notifications] = results;
  return {
    events: events.data!.map((e) => ({
      ...e,
      attendance: attendance.data!.find((a) => a.event_id === e.id)?.status,
      saved: saves.data!.some((s) => s.event_id === e.id),
    })),
    profile: profile.data!,
    notifications: notifications.data!,
  };
}
export async function mutate(action: string, input: unknown) {
  try {
    const { client, user } = await studentClient();
    const data = z.record(z.string(), z.unknown()).parse(input);
    let result;
    if (action === 'create') {
      const parsed = activitySchema.parse(data);
      result = await client.rpc('create_activity', { input: parsed });
    } else if (action === 'profile') {
      const p = z
        .object({
          name: z.string().trim().min(2).max(80),
          interests: z.array(z.string().max(40)).max(6),
          reminders: z.boolean(),
        })
        .parse(data);
      result = await client.from('profiles').update(p).eq('id', user.id);
    } else if (action === 'submit') {
      const draft = normalizeInput(data, String(data.source_url));
      const screenshot = data.screenshot;
      delete data.screenshot;
      if (screenshot instanceof File && screenshot.size) {
        const bytes = await prepareScreenshot(screenshot);
        const path = `${user.id}/${crypto.randomUUID()}.webp`;
        const upload = await client.storage
          .from('event-submissions')
          .upload(path, bytes, { contentType: 'image/webp', upsert: false });
        if (upload.error) throw new Error(upload.error.message);
        data.screenshot_path = path;
      }
      result = await client.from('import_drafts').insert({
        submitted_by: user.id,
        fingerprint: draft.fingerprint,
        content_hash: draft.content_hash,
        payload: draft,
        raw: data,
        confidence: draft.confidence,
        status: 'review',
      });
    } else if (action === 'save') {
      const id = z.uuid().parse(data.id);
      result = data.saved
        ? await client.from('saves').insert({ event_id: id, user_id: user.id })
        : await client.from('saves').delete().eq('event_id', id).eq('user_id', user.id);
    } else if (action === 'block') {
      result = await client.rpc('block_student', { target: z.uuid().parse(data.id) });
    } else {
      const id = z.uuid().parse(data.id);
      const rpcs: Record<string, { name: string; args: Record<string, unknown> }> = {
        join: { name: 'join_activity', args: { eid: id } },
        leave: { name: 'leave_activity', args: { eid: id } },
        cancel: { name: 'cancel_activity', args: { eid: id } },
        announce: { name: 'post_announcement', args: { eid: id, body: data.body } },
        report: {
          name: 'report_event',
          args: {
            eid: id,
            reason: data.reason || 'incorrect',
            details: String(data.details || ''),
          },
        },
        view: { name: 'track_event', args: { eid: id, action: 'view' } },
        check_in: { name: 'track_event', args: { eid: id, action: 'check_in' } },
        no_show: { name: 'track_event', args: { eid: id, action: 'no_show' } },
      };
      if (!rpcs[action]) throw new Error('Unknown action');
      result = await client.rpc(rpcs[action].name, rpcs[action].args);
    }
    if (result.error) throw new Error(result.error.message);
    return { ok: true, data: result.data };
  } catch (error) {
    return {
      error:
        error instanceof z.ZodError
          ? error.issues.map((i) => i.message).join('. ')
          : error instanceof Error
            ? error.message
            : 'Something went wrong',
    };
  }
}
export async function eventAnnouncements(id: string) {
  const { client } = await studentClient();
  const { data, error } = await client
    .from('announcements')
    .select('*')
    .eq('event_id', z.uuid().parse(id))
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function loadModeration() {
  const { client } = await studentClient();
  const { data: role } = await client.rpc('is_moderator');
  if (!role) throw new Error('Moderator required');
  const results = await Promise.all([
    client.from('reports').select('*').eq('status', 'open'),
    client.from('import_drafts').select('*').eq('status', 'review'),
    client.from('sources').select('*'),
    client.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    client.rpc('pilot_metrics'),
  ]);
  for (const r of results) if (r.error) throw new Error(r.error.message);
  return {
    reports: results[0].data,
    drafts: results[1].data,
    sources: results[2].data,
    audit: results[3].data,
    metrics: results[4].data,
  };
}
export async function moderate(id: string, resolution: string, note: string) {
  const { client } = await studentClient();
  const { error } = await client.rpc('moderate_event', {
    eid: z.uuid().parse(id),
    resolution,
    note,
  });
  if (error) throw new Error(error.message);
}
export async function reviewDraft(
  id: string,
  decision: string,
  input: unknown,
  duplicateId?: string,
) {
  const { client } = await studentClient();
  const parsed = decision === 'publish' ? activitySchema.parse(input) : {};
  const { error } = await client.rpc('review_draft', {
    draft_id: z.uuid().parse(id),
    decision,
    input: parsed,
    duplicate_id: duplicateId ? z.uuid().parse(duplicateId) : null,
  });
  if (error) throw new Error(error.message);
}

export async function screenshotUrl(path: string) {
  const { client } = await studentClient();
  const { data, error } = await client.storage.from('event-submissions').createSignedUrl(path, 60);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
