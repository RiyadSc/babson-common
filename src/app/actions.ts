'use server';
import { z } from 'zod';
import {
  activitySchema,
  clubProfileSchema,
  isBabsonEmail,
} from '@/lib/domain';
import { serverClient, studentClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/env';
import { prepareLogo, preparePoster } from '@/lib/attachments';
import { normalizeInput } from '@/lib/ingestion';
import { loadHubData } from '@/lib/hub-data';
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
  return loadHubData(await studentClient());
}
async function uploadLogo(
  client: Awaited<ReturnType<typeof studentClient>>['client'],
  userId: string,
  file: FormDataEntryValue | null,
) {
  if (!(file instanceof File) || !file.size) return null;
  const bytes = await prepareLogo(file);
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const upload = await client.storage
    .from('club-logos')
    .upload(path, bytes, { contentType: 'image/webp', upsert: false });
  if (upload.error) throw new Error(upload.error.message);
  return path;
}
function actionError(error: unknown) {
  return error instanceof z.ZodError
    ? error.issues.map((i) => i.message).join('. ')
    : error instanceof Error
      ? error.message
      : 'Something went wrong';
}
export async function requestClub(form: FormData) {
  try {
    const { client, user } = await studentClient();
    const input = z
      .object({
        organizer_id: z.union([z.uuid(), z.literal('')]),
        club_name: z.string().trim().max(100),
        role_title: z.string().trim().min(2, 'Tell us your role in the club').max(80),
        note: z.string().trim().max(500),
      })
      .parse({
        organizer_id: form.get('organizer_id') || '',
        club_name: form.get('club_name') || '',
        role_title: form.get('role_title') || '',
        note: form.get('note') || '',
      });
    if (!input.organizer_id && input.club_name.length < 2)
      throw new Error('Choose your club or type its name');
    const logo = await uploadLogo(client, user.id, form.get('logo'));
    const { error } = await client.rpc('request_club', {
      p_organizer: input.organizer_id || null,
      p_name: input.club_name,
      p_role: input.role_title,
      p_note: input.note,
      p_logo: logo,
    });
    if (error) {
      if (logo) await client.storage.from('club-logos').remove([logo]);
      throw new Error(error.message);
    }
    return { ok: true };
  } catch (error) {
    return { error: actionError(error) };
  }
}
export async function updateClub(form: FormData) {
  try {
    const { client, user } = await studentClient();
    const id = z.uuid().parse(form.get('organizer_id'));
    const profile = clubProfileSchema.parse({
      bio: form.get('bio') || '',
      instagram: form.get('instagram') || '',
      website: form.get('website') || '',
    });
    const logo = await uploadLogo(client, user.id, form.get('logo'));
    const { error } = await client.rpc('update_club', {
      org: id,
      p_bio: profile.bio,
      p_instagram: profile.instagram,
      p_website: profile.website,
      p_logo: logo,
    });
    if (error) {
      if (logo) await client.storage.from('club-logos').remove([logo]);
      throw new Error(error.message);
    }
    return { ok: true };
  } catch (error) {
    return { error: actionError(error) };
  }
}
export async function eventAttendees(id: string) {
  const { client } = await studentClient();
  const { data, error } = await client.rpc('event_attendees', { eid: z.uuid().parse(id) });
  if (error) throw new Error(error.message);
  return data as { name: string; status: string; joined_at: string }[];
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
      const poster = data.poster;
      delete data.poster;
      if (poster instanceof File && poster.size) {
        const bytes = await preparePoster(poster);
        const path = `${user.id}/${crypto.randomUUID()}.webp`;
        const upload = await client.storage
          .from('event-posters')
          .upload(path, bytes, { contentType: 'image/webp', upsert: false });
        if (upload.error) throw new Error(upload.error.message);
        const { data: publicPoster } = client.storage.from('event-posters').getPublicUrl(path);
        data.poster_path = path;
        data.image = publicPoster.publicUrl;
      }
      const suggestion = {
        ...draft,
        organizer_id: typeof data.organizer_id === 'string' ? data.organizer_id : '',
        poster_path: data.poster_path || null,
        image: typeof data.image === 'string' ? data.image : draft.image,
        raw: { ...data, poster: undefined },
      };
      result = await client.rpc('submit_suggestion', { payload: suggestion });
      if (result.error && data.poster_path) {
        await client.storage.from('event-posters').remove([String(data.poster_path)]);
      }
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
    client.from('import_drafts').select('*').eq('status', 'review').order('created_at', { ascending: false }),
    client.from('sources').select('*'),
    client.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    client.rpc('pilot_metrics'),
    client.rpc('pending_club_requests'),
    client
      .from('organizers')
      .select('id,name,verified_at,owner_id,profiles:owner_id(name)')
      .eq('kind', 'club')
      .not('verified_at', 'is', null)
      .order('name'),
    client
      .from('event_feed')
      .select('id,title,status,category,organizer,organizer_id,source_name,starts_at,location,kind,image')
      .order('starts_at', { ascending: false })
      .limit(1000),
  ]);
  for (const r of results) if (r.error) throw new Error(r.error.message);
  return {
    reports: results[0].data,
    suggestions: (results[1].data || []).filter(
      (d) => d.submitted_by && !d.source_id,
    ),
    drafts: (results[1].data || []).filter((d) => d.source_id),
    sources: results[2].data,
    audit: results[3].data,
    metrics: results[4].data,
    clubRequests: results[5].data as {
      id: string;
      organizer_id: string | null;
      club_name: string;
      role_title: string;
      note: string | null;
      logo_path: string | null;
      requester_name: string;
      requester_email: string;
      created_at: string;
      current_owner: string | null;
    }[],
    verifiedClubs: results[6].data as unknown as {
      id: string;
      name: string;
      verified_at: string;
      profiles: { name: string } | null;
    }[],
    events: results[7].data || [],
  };
}
export async function reviewClubRequest(id: string, decision: 'approve' | 'reject', note: string) {
  const { client } = await studentClient();
  const { error } = await client.rpc('review_club_request', {
    rid: z.uuid().parse(id),
    decision,
    p_note: note.trim().slice(0, 500) || null,
  });
  if (error) throw new Error(error.message);
}
export async function revokeClub(id: string) {
  const { client } = await studentClient();
  const { error } = await client.rpc('revoke_club', { org: z.uuid().parse(id) });
  if (error) throw new Error(error.message);
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
export async function deleteEvent(id: string, note: string) {
  const { client } = await studentClient();
  const reason = z.string().trim().min(10, 'Give a deletion reason of at least 10 characters').max(500).parse(note);
  const { data, error } = await client.rpc('delete_event', {
    eid: z.uuid().parse(id),
    note: reason,
  });
  if (error) throw new Error(error.message);
  const deleted = data as { id: string; title: string; image: string | null };
  const marker = '/storage/v1/object/public/event-posters/';
  if (deleted.image?.includes(marker)) {
    const path = decodeURIComponent(deleted.image.split(marker)[1].split('?')[0]);
    await client.storage.from('event-posters').remove([path]);
  }
  return deleted;
}
export async function setSourceEnabled(id: string, enabled: boolean, note: string) {
  const { client } = await studentClient();
  const reason = z.string().trim().min(10, 'Give a reason of at least 10 characters').max(500).parse(note);
  const { error } = await client.rpc('set_source_enabled', {
    source_id: z.uuid().parse(id),
    should_enable: z.boolean().parse(enabled),
    note: reason,
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
