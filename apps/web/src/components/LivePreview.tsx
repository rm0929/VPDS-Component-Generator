import type { ReactNode } from 'react';
import { Surface } from '@visa/nova-react';

export default function LivePreview({ children }: { children: ReactNode }) {
  return <Surface className="live-preview">{children}</Surface>;
}
