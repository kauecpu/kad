/** Preserve the current question's unsent comment across background renders, never across owners/routes. */
export function captureStudyDraft(root: HTMLElement): () => void {
  const form = root.querySelector<HTMLFormElement>('form[data-form="question-comment"]');
  const field = form?.querySelector<HTMLTextAreaElement>('textarea[name="comment"]');
  if (!form || !field) return () => {};
  const questionId = form.dataset.questionId;
  const value = field.value;
  const focused = document.activeElement === field;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const open = field.closest('details')?.open;
  return () => {
    const nextForm = root.querySelector<HTMLFormElement>('form[data-form="question-comment"]');
    if (!nextForm || nextForm.dataset.questionId !== questionId) return;
    const next = nextForm.querySelector<HTMLTextAreaElement>('textarea[name="comment"]');
    if (!next) return;
    next.value = value;
    const details = next.closest('details');
    if (details && open !== undefined) details.open = open;
    if (focused) {
      next.focus({ preventScroll: true });
      next.setSelectionRange(start, end);
    }
  };
}
