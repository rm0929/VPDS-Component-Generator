// Fixed application-owned TSX, never source supplied by the model.
// Tests compare these functions with their preview counterparts.
export const dialogExampleSource = `type DialogPresentationProps = { id: string; title: string; content: string; triggerLabel: string; closeLabel: string };

function DialogExample({ id, title, content, triggerLabel, closeLabel }: DialogPresentationProps) {
  const { ref, onKeyNavigation } = useFocusTrap<HTMLDialogElement>();
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const restoreFocus = () => trigger.current?.focus();
    dialog?.addEventListener('close', restoreFocus);
    return () => dialog?.removeEventListener('close', restoreFocus);
  }, [ref]);
  return <>
    <Button id={id} type="button" ref={trigger} aria-haspopup="dialog" aria-controls={\`\${id}--dialog\`}
      onClick={() => { if (!ref.current?.open) ref.current?.showModal(); }}>{triggerLabel}</Button>
    <Dialog style={{ inlineSize: '30rem', maxInlineSize: 'calc(100vw - 2rem)' }} id={\`\${id}--dialog\`} ref={ref} aria-labelledby={\`\${id}--title\`} aria-describedby={\`\${id}--content\`}
      onKeyDown={event => onKeyNavigation(event, Boolean(ref.current?.open))}>
      <DialogContent>
        <DialogHeader id={\`\${id}--title\`} tag="h2">{title}</DialogHeader>
        <Typography id={\`\${id}--content\`}>{content}</Typography>
        <Button type="button" autoFocus onClick={() => ref.current?.close()}>{closeLabel}</Button>
      </DialogContent>
    </Dialog>
  </>;
}
`;

export const flagExampleSource = `type FlagPresentationProps = { id: string; content: string; title?: string; variant: 'information' | 'success' | 'warning' | 'error' | 'subtle'; dismissible: boolean };

function FlagExample({ id, content, title, variant, dismissible }: FlagPresentationProps) {
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
`;
