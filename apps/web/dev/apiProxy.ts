import type { ProxyOptions } from 'vite';

/** Keep browser cancellation connected to Express while it waits for Ollama. */
export function createApiProxy(target: string): ProxyOptions {
  return {
    target,
    changeOrigin: false,
    configure(proxy) {
      proxy.on('proxyReq', (upstream, _request, response) => {
        const cleanup = () => {
          response.removeListener('close', onClose);
          response.removeListener('finish', cleanup);
          upstream.removeListener('close', cleanup);
        };
        const onClose = () => {
          cleanup();
          if (!response.writableFinished) upstream.destroy();
        };
        // IncomingMessage's close also means a normally completed upload.
        // ServerResponse's premature close identifies a disconnected caller,
        // including while the upstream has not sent response headers yet.
        response.once('close', onClose);
        response.once('finish', cleanup);
        upstream.once('close', cleanup);
        if (response.destroyed && !response.writableFinished) onClose();
      });
    },
  };
}
