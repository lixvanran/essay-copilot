type Props = { onReset?: () => void };

export default function Header({ onReset }: Props) {
  return (
    <header className="border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            作文副驾驶 <span className="text-ink-400 font-normal text-sm">· Style Co-Pilot</span>
          </h1>
          <p className="text-xs text-ink-400 mt-0.5">不是写得最好，而是写得最像你</p>
        </div>
        {onReset && (
          <button
            onClick={onReset}
            className="text-sm text-ink-500 hover:text-ink-800 px-3 py-1.5 rounded-md hover:bg-ink-50 transition"
          >
            重新开始
          </button>
        )}
      </div>
    </header>
  );
}
