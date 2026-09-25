import { expect, it, vi } from 'vitest';
import { isTransientQueryError, runTransientQuery } from '../src/lib/transient-query';

it('retries a newly issued JWT with bounded backoff', async () => {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ data: null, error: { message: 'JWT issued at future' } })
    .mockResolvedValueOnce({ data: null, error: { message: 'JWT issued at future' } })
    .mockResolvedValueOnce({ data: ['ready'], error: null });
  const sleep = vi.fn().mockResolvedValue(undefined);

  await expect(
    runTransientQuery('organizers', query, { delaysMs: [0, 750, 1500], sleep }),
  ).resolves.toEqual(['ready']);
  expect(query).toHaveBeenCalledTimes(3);
  expect(sleep.mock.calls).toEqual([[750], [1500]]);
});

it('does not retry permanent authorization or schema failures', async () => {
  const query = vi.fn().mockResolvedValue({
    data: null,
    error: { message: 'permission denied for table organizers' },
  });

  await expect(runTransientQuery('organizers', query)).rejects.toThrow(
    'organizers: permission denied for table organizers',
  );
  expect(query).toHaveBeenCalledOnce();
});

it('classifies transport failures without treating expired tokens as transient', () => {
  expect(isTransientQueryError('TypeError: fetch failed')).toBe(true);
  expect(isTransientQueryError('upstream timed out')).toBe(true);
  expect(isTransientQueryError('JWT expired')).toBe(false);
});
