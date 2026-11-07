/**
 * Bounded exponential backoff for outbox jobs. Pure and deterministic (no jitter), so the
 * schedule can be unit-tested and shown to merchants exactly as it behaves.
 */
export interface RetryPolicy {
  /** Total attempts (first try included) before an event is dead-lettered. */
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export const RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 10_000,
  maxDelayMs: 10 * 60_000,
};

/** Delay before the next attempt after `failedAttempts` consecutive failures (1-based). */
export function retryDelayMs(failedAttempts: number, policy: RetryPolicy = RETRY_POLICY): number {
  if (!Number.isInteger(failedAttempts) || failedAttempts < 1) {
    throw new RangeError("failedAttempts must be a positive integer");
  }
  // Cap the exponent too, so large attempt counts can never overflow to Infinity.
  const exponent = Math.min(failedAttempts - 1, 30);
  return Math.min(policy.baseDelayMs * 2 ** exponent, policy.maxDelayMs);
}

/** Every automatic retry delay an event can go through, in order. */
export function retrySchedule(policy: RetryPolicy = RETRY_POLICY): number[] {
  return Array.from({ length: Math.max(policy.maxAttempts - 1, 0) }, (_, index) =>
    retryDelayMs(index + 1, policy),
  );
}

export type FailurePlan =
  | { readonly outcome: "retry"; readonly delayMs: number; readonly nextAttemptAt: string }
  | { readonly outcome: "dead" };

/**
 * Decides what happens after a failed attempt. `attempts` already includes the attempt that
 * just failed. Permanent failures (e.g. an invalid payload) skip straight to the dead letter.
 */
export function planAfterFailure(
  input: { readonly attempts: number; readonly maxAttempts: number; readonly permanent: boolean },
  now: Date,
  policy: RetryPolicy = RETRY_POLICY,
): FailurePlan {
  if (input.permanent || input.attempts >= input.maxAttempts) return { outcome: "dead" };
  const delayMs = retryDelayMs(input.attempts, policy);
  return {
    outcome: "retry",
    delayMs,
    nextAttemptAt: new Date(now.getTime() + delayMs).toISOString(),
  };
}

/** "10 s", "1 min 20 s", "10 min". */
export function formatDelay(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} s`;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}
