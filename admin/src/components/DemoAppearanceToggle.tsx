import { useDemoAppearance } from '../lib/demo-appearance-context';

function SunIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 3a1 1 0 011 1v1a1 1 0 11-2 0V4a1 1 0 011-1zm0 12a3 3 0 100-6 3 3 0 000 6zm7-4a1 1 0 110 2h-1a1 1 0 110-2h1zM4 10a1 1 0 110 2H3a1 1 0 110-2h1zm11.657-5.657a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM6.464 13.536a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zm0-9.9a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zm7.072 9.9a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
    </svg>
  );
}

export default function DemoAppearanceToggle() {
  const { appearance, isDemoToggleEnabled, setAppearance } = useDemoAppearance();

  if (!isDemoToggleEnabled || !appearance) return null;

  return (
    <div
      className="demo-appearance-toggle flex rounded-lg border border-brandNavy-700/60 bg-brandNavy-900/60 p-0.5"
      role="group"
      aria-label="Appearance"
    >
      <button
        type="button"
        onClick={() => setAppearance('light')}
        aria-pressed={appearance === 'light'}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
          appearance === 'light'
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <SunIcon className="h-3.5 w-3.5" />
        Light
      </button>
      <button
        type="button"
        onClick={() => setAppearance('dark')}
        aria-pressed={appearance === 'dark'}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
          appearance === 'dark'
            ? 'bg-brandNavy-800 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <MoonIcon className="h-3.5 w-3.5" />
        Dark
      </button>
    </div>
  );
}
