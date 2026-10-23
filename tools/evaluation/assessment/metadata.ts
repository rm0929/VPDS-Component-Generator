import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { OllamaConfig } from '../../../apps/api/src/providerConfig';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function metadataJson(url: string, request: typeof fetch): Promise<unknown> {
  const response = await request(url, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok || !response.body) throw new Error('Local runtime metadata unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > 65536) throw new Error('Metadata limit exceeded');
      chunks.push(item.value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Public read-only local endpoints; never emit the complete model list or runtime errors. */
export async function runtimeMetadata(config: OllamaConfig, request: typeof fetch = fetch) {
  const version = z.object({ version: z.string().max(80).regex(/^[0-9][a-zA-Z0-9.+-]*$/) })
    .parse(await metadataJson(`${config.baseUrl}/api/version`, request)).version;
  const tags = z.object({ models: z.array(z.object({ name: z.string(), digest: z.string().regex(/^[a-f0-9]{64}$/i) })) })
    .parse(await metadataJson(`${config.baseUrl}/api/tags`, request));
  const model = tags.models.find(item => item.name === config.model);
  if (!model) throw new Error('Configured local model not installed');
  return { ollamaVersion: version, modelDigest: model.digest };
}

export function sourceMetadata(root: string) {
  const compilerFiles = ['apps/api/src/ai/compileModelUi.ts', 'apps/api/src/ai/modelUiDraft.ts',
    'packages/ui-specification/src/componentRegistry.ts', 'packages/ui-specification/src/uiSpecification.ts'];
  const compilerHashes = Object.fromEntries(compilerFiles.map(file => [file, hash(readFileSync(resolve(root, file), 'utf8'))]));
  const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 2000 }).trim();
  return { gitCommit, nodeVersion: process.version, compilerRevision: hash(JSON.stringify(compilerHashes)), compilerHashes };
}
