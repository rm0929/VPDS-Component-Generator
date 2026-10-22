import { useEffect, useRef } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, Typography, useFocusTrap } from '@visa/nova-react';
import type { DialogPresentationProps } from '../presentation';

/** Native modal state, inert background and Escape; Nova handles Tab wrapping. */
export function DialogExample({ id, title, content, triggerLabel, closeLabel }: DialogPresentationProps) {
  const { ref, onKeyNavigation } = useFocusTrap<HTMLDialogElement>();
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const restoreFocus = () => trigger.current?.focus();
    dialog?.addEventListener('close', restoreFocus);
    return () => dialog?.removeEventListener('close', restoreFocus);
  }, [ref]);
  return <>
    <Button id={id} type="button" ref={trigger} aria-haspopup="dialog" aria-controls={`${id}--dialog`}
      onClick={() => { if (!ref.current?.open) ref.current?.showModal(); }}>{triggerLabel}</Button>
    <Dialog style={{ inlineSize: '30rem', maxInlineSize: 'calc(100vw - 2rem)' }} id={`${id}--dialog`} ref={ref} aria-labelledby={`${id}--title`} aria-describedby={`${id}--content`}
      onKeyDown={event => onKeyNavigation(event, Boolean(ref.current?.open))}>
      <DialogContent>
        <DialogHeader id={`${id}--title`} tag="h2">{title}</DialogHeader>
        <Typography id={`${id}--content`}>{content}</Typography>
        <Button type="button" autoFocus onClick={() => ref.current?.close()}>{closeLabel}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
