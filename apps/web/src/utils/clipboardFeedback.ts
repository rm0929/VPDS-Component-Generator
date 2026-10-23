export type CopyState = 'idle' | 'copying' | 'copied' | 'error';

export function createClipboardFeedback(onChange: (state: CopyState) => void,
  write: (text: string) => Promise<void> = text => navigator.clipboard.writeText(text)) {
  let version = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const dispose = () => { version++; clearTimeout(timer); };
  return {
    async copy(text: string) {
      dispose();
      const attempt = version;
      onChange('copying');
      try {
        await write(text);
        if (attempt !== version) return;
        onChange('copied');
        timer = setTimeout(() => { if (attempt === version) onChange('idle'); }, 2000);
      } catch {
        if (attempt === version) onChange('error');
      }
    },
    dispose,
  };
}
