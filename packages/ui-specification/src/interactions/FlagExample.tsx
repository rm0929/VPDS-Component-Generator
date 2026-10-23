import { useState } from 'react';
import { Flag, FlagCloseButton, FlagContent, MessageIcon, Typography } from '@visa/nova-react';
import type { FlagPresentationProps } from '../presentation';

export function FlagExample({ id, content, title, variant, dismissible }: FlagPresentationProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <Flag id={id} messageType={variant === 'information' ? undefined : variant}
    role="status" aria-live="polite" aria-atomic="true">
    <MessageIcon />
    <FlagContent>
      {title !== undefined && <Typography tag="h3" variant="headline-4">{title}</Typography>}
      <Typography>{content}</Typography>
    </FlagContent>
    {dismissible && <FlagCloseButton type="button" aria-label="Dismiss message" onClick={() => setVisible(false)} />}
  </Flag>;
}
