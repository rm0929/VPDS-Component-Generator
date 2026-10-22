import { ApiError } from './errors';
import type { ApiConfig } from './config';

const DAY_MS = 86400000;

/** Bounded, per-process rolling budgets; not authentication or durable quotas. */
export function createRequestLimiter(config: ApiConfig['rateLimit'], now = Date.now) {
  // At most dailyMax timestamps (configuration caps that at 1,000).
  const admissions: number[] = [];
  return () => {
    if (!config.enabled) return;
    const time = now();
    while (admissions.length && time - admissions[0] >= DAY_MS) admissions.shift();
    const recent = admissions.filter(admitted => time - admitted < config.windowMs);
    const dailyWait = admissions.length >= config.dailyMax ? admissions[0] + DAY_MS - time : 0;
    const windowWait = recent.length >= config.max ? recent[0] + config.windowMs - time : 0;
    const remaining = Math.max(dailyWait, windowWait);
    if (remaining > 0) throw new ApiError('RATE_LIMITED', Math.max(1, Math.ceil(remaining / 1000)));
    admissions.push(time); // Failed admitted attempts count too; no automatic retries.
  };
}
