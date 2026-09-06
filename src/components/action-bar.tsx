type ActionBarProps = {
  busy: boolean;
  onRun: () => void;
  onSubmit: () => void;
};

export function ActionBar({ busy, onRun, onSubmit }: ActionBarProps) {
  return (
    <div className="flex items-center gap-3 border-t border-stone-300 bg-stone-100 px-4 py-3">
      <button
        type="button"
        onClick={onRun}
        disabled={busy}
        className="rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Run
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy}
        className="rounded-sm border border-stone-800 bg-white px-4 py-2 text-sm font-medium text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit
      </button>
      {busy ? (
        <span className="text-sm text-stone-600">Running…</span>
      ) : null}
    </div>
  );
}
