import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { publicEnv } from './env';
import { parseFeed, ConnectorKind } from './ingestion';
export function authorizedJob(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  return Boolean(
    secret &&
    secret.length >= 32 &&
    Buffer.byteLength(provided) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected)),
  );
}
export function adminClient() {
  const { url } = publicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Service role is not configured');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function runReminders() {
  const db = adminClient();
  const { data: queued, error } = await db.rpc('enqueue_reminders');
  if (error) throw error;
  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM)
    return { queued, email: 'not configured' };
  const batch = await db.rpc('claim_deliveries');
  if (batch.error) throw batch.error;
  let delivered = 0;
  for (const row of batch.data || []) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': row.notification_id,
        },
        body: JSON.stringify({
          from: process.env.REMINDER_FROM,
          to: [row.email],
          subject: 'A little update from Common',
          text: row.message,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
      const data = await response.json();
      const result = await db
        .from('deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          provider_id: data.id,
          last_error: null,
        })
        .eq('notification_id', row.notification_id);
      if (result.error) throw result.error;
      delivered++;
    } catch (e) {
      await db
        .from('deliveries')
        .update({
          status: 'failed',
          last_error: e instanceof Error ? e.message : 'Delivery failed',
        })
        .eq('notification_id', row.notification_id);
    }
  }
  return { queued, delivered };
}
export async function storeImport(
  sourceId: string,
  content: string,
  kind: ConnectorKind,
  url: string,
) {
  const db = adminClient();
  const result = parseFeed(content, kind, url);
  const { data: sourceRow } = await db
    .from('sources')
    .select('auto_publish')
    .eq('id', sourceId)
    .single();
  const autoPublish = Boolean(sourceRow?.auto_publish);
  let published = 0;
  for (const draft of result.drafts) {
    const { data: existing } = await db
      .from('import_drafts')
      .select('id,published_event_id,source_id,external_id')
      .eq('fingerprint', draft.fingerprint)
      .not('published_event_id', 'is', null)
      .limit(1);
    const match = existing?.[0];
    const isRevision =
      match?.source_id === sourceId &&
      draft.external_id &&
      match?.external_id === draft.external_id;
    const duplicate = isRevision ? null : match?.published_event_id;
    const { data: upserted, error } = await db
      .from('import_drafts')
      .upsert(
        {
          source_id: sourceId,
          external_id: draft.external_id,
          fingerprint: draft.fingerprint,
          content_hash: draft.content_hash,
          payload: draft,
          raw: draft.raw,
          confidence: draft.confidence,
          status: duplicate ? 'duplicate' : 'review',
          duplicate_of: duplicate || null,
        },
        { onConflict: 'source_id,fingerprint,content_hash', ignoreDuplicates: false },
      )
      .select('id,status')
      .single();
    if (error) throw error;
    if (
      autoPublish &&
      upserted?.status === 'review' &&
      draft.external_id &&
      draft.confidence >= 0.9 &&
      new Date(draft.starts_at).getTime() > Date.now()
    ) {
      const { error: publishError } = await db.rpc('auto_publish_draft', {
        draft_id: upserted.id,
      });
      if (publishError) result.errors.push(`Auto-publish: ${publishError.message}`);
      else published++;
    }
  }
  return { drafts: result.drafts.length, published, errors: result.errors };
}
