import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('../src/lib/env', () => ({ publicEnv: () => ({ url: 'https://example.test', key: 'test' }) }));
import { storeImport } from '../src/lib/jobs';

beforeEach(() => { vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test'); });

it.each(['published', 'rejected', 'duplicate', 'review'])(
  'preserves an unchanged %s draft on scheduled retries', async (status) => {
    const upsert = vi.fn();
    const rpc = vi.fn().mockResolvedValue({ data: 'event-1', error: null });
    const draftQuery = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      upsert, maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'draft-1', status }, error: null }),
    };
    upsert.mockReturnValue(draftQuery);
    mocks.createClient.mockReturnValue({
      from: (table: string) => table === 'sources' ? {
        select: () => ({ eq: () => ({ single: async () => ({ data: { auto_publish: true } }) }) }),
      } : draftQuery,
      rpc,
    });
    const result = await storeImport('source-1', JSON.stringify([{
      title: 'Coffee together', description: 'Meet some new people over coffee.',
      location: 'Campus center', starts_at: '2099-01-01T18:00:00Z',
      ends_at: '2099-01-01T20:00:00Z', external_id: 'coffee-1',
    }]), 'web', 'https://example.test/feed');
    expect(upsert).toHaveBeenCalledWith(expect.any(Object), {
      onConflict: 'source_id,fingerprint,content_hash', ignoreDuplicates: true,
    });
    expect(rpc).toHaveBeenCalledTimes(status === 'review' ? 1 : 0);
    expect(result.published).toBe(status === 'review' ? 1 : 0);
  },
);
