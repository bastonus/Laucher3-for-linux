import React, { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { CUSTOM_APP_ICONS } from '../data/customApps';
import { adaptIcon } from '../engine/iconAdapter';
import {
  AdapterSettings,
  FrostIconItem,
  IconCategory,
  IconPackId,
  PackSummary,
} from '../types/adapter';
import { AdaptedIconView, getOriginalIconUrl } from './AdaptedIconView';

interface FrostLibraryViewProps {
  packs: PackSummary[];
  customIcons: FrostIconItem[];
  activePack: 'all' | IconPackId;
  onActivePackChange: (pack: 'all' | IconPackId) => void;
  settings: AdapterSettings;
  selectedIconId: string;
  onSelectForWorkbench: (icon: FrostIconItem) => void;
}

type GalleryMode = 'adapted' | 'original' | 'homescreen';

export const FrostLibraryView: React.FC<FrostLibraryViewProps> = ({
  packs,
  customIcons,
  activePack,
  onActivePackChange,
  settings,
  selectedIconId,
  onSelectForWorkbench,
}) => {
  const [category, setCategory] = useState<'all' | IconCategory>('all');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<GalleryMode>('adapted');
  const [remoteIcons, setRemoteIcons] = useState<FrostIconItem[]>([]);
  const [remoteTotal, setRemoteTotal] = useState(0);
  const [remoteCounts, setRemoteCounts] = useState<Record<string, number>>({});
  const [loadingPage, setLoadingPage] = useState(false);
  const [limit, setLimit] = useState(72);

  useEffect(() => {
    if (activePack === 'custom') {
      setRemoteIcons([]);
      setRemoteTotal(customIcons.length);
      setRemoteCounts({ all: customIcons.length, custom: customIcons.length });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function fetchIcons() {
      setLoadingPage(true);
      try {
        const normalizedQ = query.trim().toLowerCase().replace('antigracity', 'antigravity');
        const params = new URLSearchParams({
          pack: activePack,
          category: category === 'custom' ? 'all' : category,
          q: normalizedQ,
          offset: '0',
          limit: String(limit),
        });
        const res = await fetch(`/api/icons?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setRemoteIcons(data.icons ?? []);
        setRemoteTotal(data.total ?? 0);
        setRemoteCounts(data.counts ?? {});
      } catch {
        // Ignore abort errors on rapid typing
      } finally {
        if (!cancelled) setLoadingPage(false);
      }
    }

    const timer = setTimeout(() => {
      void fetchIcons();
    }, 80);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [activePack, category, query, limit, customIcons.length]);

  const displayed = useMemo(() => {
    const rawQ = query.trim().toLowerCase();
    const q = rawQ.replace('antigracity', 'antigravity');
    const matchingCustom = customIcons.filter((item) => {
      if (activePack !== 'all' && activePack !== 'custom') return false;
      if (category !== 'all' && category !== 'custom') return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.family.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    if (activePack === 'custom') return matchingCustom;
    if (category === 'custom') return customIcons;
    return [...matchingCustom, ...remoteIcons];
  }, [activePack, category, query, customIcons, remoteIcons]);

  const homescreenIcons = useMemo(() => {
    const base = displayed.length >= 20 ? displayed : [...customIcons, ...remoteIcons];
    return base.slice(0, 20);
  }, [displayed, customIcons, remoteIcons]);

  const handleQuickDownload = async (e: React.MouseEvent, item: FrostIconItem) => {
    e.stopPropagation();
    const res = await adaptIcon(item, settings, 256);
    const a = document.createElement('a');
    a.href = res.pngDataUrl;
    a.download = `${item.name}-ios-squircle.png`;
    a.click();
  };

  const totalAcrossAllPacks =
    packs.reduce((sum, p) => sum + p.total, 0) + customIcons.length;

  const packButtons: Array<{ id: 'all' | IconPackId; label: string; count: number }> = [
    { id: 'frost', label: 'Frost', count: packs.find((p) => p.id === 'frost')?.total ?? 0 },
    { id: 'papirus', label: 'Papirus', count: packs.find((p) => p.id === 'papirus')?.total ?? 0 },
    { id: 'colloid', label: 'Colloid', count: packs.find((p) => p.id === 'colloid')?.total ?? 0 },
    { id: 'reversal', label: 'Reversal', count: packs.find((p) => p.id === 'reversal')?.total ?? 0 },
    { id: 'tela', label: 'Tela', count: packs.find((p) => p.id === 'tela')?.total ?? 0 },
    { id: 'custom', label: 'Custom Apps', count: customIcons.length },
    { id: 'all', label: 'All Packs', count: totalAcrossAllPacks },
  ];

  const categoryTabs: Array<{ id: 'all' | IconCategory; label: string; count: number }> = [
    {
      id: 'all',
      label: 'All',
      count:
        activePack === 'custom'
          ? customIcons.length
          : (remoteCounts.all ?? 0) + (activePack === 'all' ? customIcons.length : 0),
    },
    ...(activePack !== 'custom'
      ? [
          { id: 'apps' as const, label: 'Apps', count: remoteCounts.apps ?? 0 },
          { id: 'places' as const, label: 'Places', count: remoteCounts.places ?? 0 },
          ...(remoteCounts.mimetypes
            ? [{ id: 'mimetypes' as const, label: 'Mimetypes', count: remoteCounts.mimetypes }]
            : []),
          ...(remoteCounts.status
            ? [{ id: 'status' as const, label: 'Status', count: remoteCounts.status }]
            : []),
        ]
      : []),
  ];

  const activePackMeta = packs.find((p) => p.id === activePack);

  return (
    <div className="flex flex-col gap-5">
      {/* Pack Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Icon Packs
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activePack === 'custom'
                ? 'Custom studio emblems: Antigravity, ArtCraft, PhotoCraft, Nuvio & uploaded icons'
                : activePack === 'all'
                ? `Searching across ${totalAcrossAllPacks.toLocaleString()} icons from Frost, Papirus, Colloid, Reversal, Tela & Custom Apps`
                : activePackMeta?.description ?? 'Select an icon pack to adapt every icon into an iOS squircle'}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {totalAcrossAllPacks.toLocaleString()} total icons indexed
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {packButtons.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onActivePackChange(p.id);
                setCategory('all');
                setLimit(72);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                activePack === p.id
                  ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {p.label} ({p.count.toLocaleString()})
            </button>
          ))}
        </div>
      </div>

      {/* Category, Search & Display Mode Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto">
          {categoryTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCategory(tab.id);
                setLimit(72);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                category === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label} ({tab.count.toLocaleString()})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(72);
              }}
              placeholder="Search firefox, settings, folder..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 dark:focus:ring-white/20"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'adapted', label: 'Adapted iOS' },
                { id: 'original', label: 'Original' },
                { id: 'homescreen', label: 'Launcher Grid' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  mode === m.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'homescreen' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col items-center gap-6">
          <div className="text-center max-w-lg">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Launcher3 × iOS Squircle Home Screen Simulation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Previewing adapted icons from the active pack inside an iOS-proportioned Launcher3 workspace grid and frosted dock. Click any icon to inspect it.
            </p>
          </div>

          <div className="w-full max-w-md rounded-3xl p-6 bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 border border-slate-800 shadow-xl flex flex-col justify-between gap-8">
            <div className="flex items-center justify-between text-[11px] font-mono text-white/80 px-1 tabular-nums">
              <span>14:28</span>
              <span>Launcher3 · {activePack}</span>
            </div>

            <div className="grid grid-cols-4 gap-y-5 gap-x-4">
              {homescreenIcons.slice(0, 16).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectForWorkbench(item)}
                  className="flex flex-col items-center gap-1.5 group focus:outline-none"
                >
                  <div className="transition-transform duration-150 group-hover:scale-105">
                    <AdaptedIconView
                      icon={item}
                      settings={settings}
                      size={58}
                      renderResolution={192}
                    />
                  </div>
                  <span className="text-[11px] text-white/90 truncate max-w-[70px] font-medium">
                    {item.name.split('.').pop()}
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-3 grid grid-cols-4 gap-3 justify-items-center">
              {(homescreenIcons.length >= 20 ? homescreenIcons.slice(16, 20) : CUSTOM_APP_ICONS).map(
                (item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectForWorkbench(item)}
                    title={item.name}
                    className="transition-transform duration-150 hover:scale-105"
                  >
                    <AdaptedIconView
                      icon={item}
                      settings={settings}
                      size={54}
                      renderResolution={192}
                    />
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      ) : loadingPage && displayed.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-sm text-slate-500">
          Loading {activePack} icons...
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
            No icons match &ldquo;{query}&rdquo;
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Try clearing the search query or switching packs.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategory('all');
            }}
            className="mt-4 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {displayed.map((item) => {
              const isSelected = item.id === selectedIconId;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectForWorkbench(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectForWorkbench(item);
                    }
                  }}
                  className={`group relative rounded-xl border p-3 flex flex-col items-center gap-2.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => handleQuickDownload(e, item)}
                    title={`Download ${item.name} PNG`}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute top-2 right-2 p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-opacity"
                  >
                    <Download className="w-3 h-3" />
                  </button>

                  <div className="w-16 h-16 flex items-center justify-center">
                    {mode === 'adapted' ? (
                      <AdaptedIconView
                        icon={item}
                        settings={settings}
                        size={60}
                        renderResolution={160}
                      />
                    ) : (
                      <img
                        src={getOriginalIconUrl(item)}
                        alt={item.name}
                        className="w-14 h-14 object-contain select-none"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>

                  <div className="w-full text-center">
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.pack ?? item.category} · {item.category}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {activePack !== 'custom' && remoteTotal > remoteIcons.length && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLimit((v) => v + 72)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors tabular-nums"
              >
                Load 72 More ({(remoteTotal - remoteIcons.length).toLocaleString()} remaining)
              </button>
              {remoteTotal <= 360 && (
                <button
                  type="button"
                  onClick={() => setLimit(remoteTotal)}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 transition-colors tabular-nums"
                >
                  Show All {remoteTotal}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
