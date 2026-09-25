type QueryError = { message: string };

type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
};

const DEFAULT_DELAYS_MS = [0, 750, 1500] as const;

export function isTransientQueryError(message: string) {
  return /jwt issued at future|fetch failed|network error|timed? out|econnreset|\b50[234]\b/i.test(
    message,
  );
}

export async function runTransientQuery<T>(
  label: string,
  query: () => PromiseLike<QueryResult<T>>,
  options: {
    delaysMs?: readonly number[];
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<NonNullable<T>> {
  const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let lastMessage = 'Unknown query failure';

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      const result = await query();
      if (!result.error) return result.data as NonNullable<T>;
      lastMessage = result.error.message;
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : String(error);
    }

    const hasAnotherAttempt = attempt + 1 < delays.length;
    if (!hasAnotherAttempt || !isTransientQueryError(lastMessage)) {
      throw new Error(`${label}: ${lastMessage}`);
    }
  }

  throw new Error(`${label}: ${lastMessage}`);
}
