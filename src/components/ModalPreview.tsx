import React from 'react';
import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  Typography,
  useFocusTrap,
  Utility,
} from '@visa/nova-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const ModalPreview: React.FC<Props> = ({ open, onClose }) => {
  const { onKeyNavigation, ref } = useFocusTrap<HTMLDialogElement>();

  React.useEffect(() => {
    if (open) {
      ref.current?.showModal();
    } else {
      ref.current?.close();
    }
  }, [open, ref]);

  React.useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    const handleClose = () => onClose();
    dlg.addEventListener('close', handleClose);
    return () => dlg.removeEventListener('close', handleClose);
  }, [ref, onClose]);

  return (
    <Dialog
      aria-labelledby="modal-title"
      aria-describedby="modal-desc"
      ref={ref}
      id="modal-dialog"
      onKeyDown={(e) => onKeyNavigation(e, ref.current?.open)}
    >
      <DialogContent
        style={{
          maxWidth: '400px',
          whiteSpace: 'normal',   
        }}
      >
        {/* Header + close */}
        <Utility vFlex vJustifyContent="between" vAlignItems="center">
          <DialogHeader id="modal-title">Default Title</DialogHeader>
          <DialogCloseButton
            aria-label="Close dialog"
            onClick={() => ref.current?.close()}
          />
        </Utility>

        <Typography
          id="modal-desc"
          style={{ marginTop: '1rem', wordBreak: 'break-word' }}
        >
          This is required text that describes the dialog title in more detail.
        </Typography>

        <Utility
          vFlex
          vFlexWrap
          vJustifyContent="end"
          vGap={8}
          vPaddingTop={16}
        >
          <Button onClick={() => ref.current?.close()}>Primary action</Button>
          <Button colorScheme="secondary" onClick={() => ref.current?.close()}>
            Secondary action
          </Button>
        </Utility>
      </DialogContent>
    </Dialog>
  );
};

export default ModalPreview;