import Modal from './Modal';

export default function BottomSheetModal({
  children,
  historyKey,
  panelClassName = '',
  size = 'lg',
  ...props
}) {
  return (
    <Modal
      {...props}
      backDismiss
      historyKey={historyKey}
      align="bottom"
      size={size}
      panelClassName={[
        'max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-[#0d1520] border-slate-700/70',
        panelClassName,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </Modal>
  );
}
