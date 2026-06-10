/**
 * On Enter: run optional action, then blur input to dismiss mobile keyboard.
 */
export function handleEnterDismiss(e, action) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  action?.();
  e.currentTarget.blur();
}