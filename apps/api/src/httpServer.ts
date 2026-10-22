import { createServer } from 'node:http';
import { createApp } from './app';
import type { AppOptions } from './app';
import { readConfig } from './config';

export function createApiServer(options: AppOptions = {}) {
  const config = options.config ?? readConfig();
  return createServer({
    requestTimeout: config.requestTimeoutMs,
    headersTimeout: Math.min(10000, config.requestTimeoutMs), keepAliveTimeout: 5000,
  }, createApp({ ...options, config }));
}
