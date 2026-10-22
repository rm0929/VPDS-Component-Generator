import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { createApiProxy } from './dev/apiProxy'

const backendPort = Number(process.env.VPDS_API_PORT ?? '3001')
if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) {
  throw new Error('VPDS_API_PORT must be an integer between 1 and 65535')
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', proxy: { '/api': createApiProxy(`http://127.0.0.1:${backendPort}`) } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
