import { useEffect, useRef } from 'react';

interface UnsavedChangesDialogProps {
  onSave: () => Promise<void>;
  onDiscard: () => Promise<void>;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className="unsaved-dialog" aria-labelledby="unsaved-title"
      onCancel={event => { event.preventDefault(); onCancel(); }}>
      <h2 id="unsaved-title">Не удалось сохранить изменения</h2>
      <p>Переход остановлен. Повторите сохранение или явно откажитесь от несохранённых изменений.</p>
      <div className="dialog-actions">
        <button className="button button-secondary" onClick={onCancel} autoFocus>Остаться</button>
        <button className="button button-secondary" onClick={() => void onDiscard()}>Не сохранять</button>
        <button className="button button-primary" onClick={() => void onSave()}>Повторить и перейти</button>
      </div>
    </dialog>
  );
}
