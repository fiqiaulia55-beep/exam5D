import type { PortalTab } from '../types.ts';

interface TopBarProps {
  activeTab: PortalTab;
  onSelectTab: (tab: PortalTab) => void;
  onOpenProctor: () => void;
}

export function TopBar({ activeTab, onSelectTab, onOpenProctor }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
        <button
          type="button"
          onClick={() => onSelectTab('gate')}
          className="text-left text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
        >
          Portal Ulangan 5D
        </button>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            type="button"
            onClick={() => onSelectTab('gate')}
            className={`whitespace-nowrap shrink-0 border-b-2 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 ${
              activeTab === 'gate'
                ? 'border-sky-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Masuk Ujian
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('monitor')}
            className={`whitespace-nowrap shrink-0 border-b-2 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 ${
              activeTab === 'monitor'
                ? 'border-sky-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Pantau Kelas
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('guide')}
            className={`whitespace-nowrap shrink-0 border-b-2 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 ${
              activeTab === 'guide'
                ? 'border-sky-600 text-slate-900'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Panduan Chromebook
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenProctor}
            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Panel Guru
          </button>
        </div>
      </div>

      {/* Mobile secondary nav row */}
      <div className="flex md:hidden items-center gap-4 border-t border-slate-100 px-6 py-2.5 text-xs font-medium overflow-x-auto">
        <button
          type="button"
          onClick={() => onSelectTab('gate')}
          className={`whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'gate'
              ? 'text-sky-700 font-semibold border-b-2 border-sky-600'
              : 'text-slate-600'
          }`}
        >
          Masuk Ujian
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('monitor')}
          className={`whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'monitor'
              ? 'text-sky-700 font-semibold border-b-2 border-sky-600'
              : 'text-slate-600'
          }`}
        >
          Pantau Kelas
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('guide')}
          className={`whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'guide'
              ? 'text-sky-700 font-semibold border-b-2 border-sky-600'
              : 'text-slate-600'
          }`}
        >
          Panduan Chromebook
        </button>
      </div>
    </header>
  );
}
