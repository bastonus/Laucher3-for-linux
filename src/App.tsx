import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Moon, Package, Sun } from 'lucide-react';
import { FrostLibraryView } from './components/FrostLibraryView';
import { GeometryView } from './components/GeometryView';
import { Launcher3DiffView } from './components/Launcher3DiffView';
import { WorkbenchView } from './components/WorkbenchView';
import { CUSTOM_APP_ICONS } from './data/customApps';
import { adaptIcon } from './engine/iconAdapter';
import {
  AdapterSettings,
  DEFAULT_IOS_ADAPTER_SETTINGS,
  FrostIconItem,
  IconPackId,
  Launcher3SourceFile,
  PackSummary,
} from './types/adapter';

type ActiveTab = 'workbench' | 'library' | 'launcher3' | 'geometry';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workbench');
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [totalIndexedIcons, setTotalIndexedIcons] = useState(0);
  const [activePack, setActivePack] = useState<'all' | IconPackId>('frost');
  const [customIcons, setCustomIcons] = useState<FrostIconItem[]>(CUSTOM_APP_ICONS);
  const [frostSampleIcons, setFrostSampleIcons] = useState<FrostIconItem[]>([]);
  const [launcherFiles, setLauncherFiles] = useState<Launcher3SourceFile[]>([]);
  const [selectedIcon, setSelectedIcon] = useState<FrostIconItem>(CUSTOM_APP_ICONS[0]);
  const [settings, setSettings] = useState<AdapterSettings>(DEFAULT_IOS_ADAPTER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const [exportProgress, setExportProgress] = useState<{
    active: boolean;
    done: number;
    total: number;
  }>({ active: false, done: 0, total: 0 });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    let mounted = true;
    async function loadInitial() {
      try {
        setLoading(true);
        const [packsRes, frostRes, papirusRes, colloidRes, reversalRes, launcherRes] =
          await Promise.all([
            fetch('/api/packs'),
            fetch('/api/icons?pack=frost&limit=6'),
            fetch('/api/icons?pack=papirus&q=firefox&limit=1'),
            fetch('/api/icons?pack=colloid&q=firefox&limit=1'),
            fetch('/api/icons?pack=reversal&q=firefox&limit=1'),
            fetch('/api/launcher3/files'),
          ]);

        if (!packsRes.ok || !frostRes.ok || !launcherRes.ok) {
          throw new Error('Failed to load icon packs or Launcher3 source files.');
        }

        const [packsData, frostData, papirusData, colloidData, reversalData, launcherData] =
          await Promise.all([
            packsRes.json(),
            frostRes.json(),
            papirusRes.ok ? papirusRes.json() : Promise.resolve({ icons: [] }),
            colloidRes.ok ? colloidRes.json() : Promise.resolve({ icons: [] }),
            reversalRes.ok ? reversalRes.json() : Promise.resolve({ icons: [] }),
            launcherRes.json(),
          ]);

        if (!mounted) return;
        setPacks(packsData.packs ?? []);
        setTotalIndexedIcons(packsData.totalIcons ?? 0);
        setLauncherFiles(launcherData.files ?? []);

        const samples: FrostIconItem[] = [
          ...(frostData.icons ?? []).slice(0, 2),
          ...(papirusData.icons ?? []).slice(0, 1),
          ...(colloidData.icons ?? []).slice(0, 1),
          ...(reversalData.icons ?? []).slice(0, 1),
        ];
        setFrostSampleIcons(samples);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Unable to initialize studio.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadInitial();
    return () => {
      mounted = false;
    };
  }, []);

  const sampleIcons = useMemo(
    () => [...customIcons.slice(0, 4), ...frostSampleIcons],
    [customIcons, frostSampleIcons]
  );

  const handleUploadCustomIcon = (item: FrostIconItem) => {
    setCustomIcons((prev) => [item, ...prev]);
    setSelectedIcon(item);
    setActiveTab('workbench');
  };

  const handleExportPack = async () => {
    if (exportProgress.active) return;

    const targetPack = activePack === 'all' ? 'frost' : activePack;
    let exportItems: FrostIconItem[] = [];

    if (targetPack === 'custom') {
      exportItems = customIcons;
    } else {
      const res = await fetch(`/api/icons?pack=${targetPack}&limit=300`);
      const data = await res.json();
      exportItems = [...(targetPack === 'frost' ? customIcons : []), ...(data.icons ?? [])];
    }

    if (exportItems.length === 0) return;

    setExportProgress({ active: true, done: 0, total: exportItems.length });
    try {
      const zip = new JSZip();
      const svgFolder = zip.folder(`${targetPack}-ios-squircle/svg`);
      const pngFolder = zip.folder(`${targetPack}-ios-squircle/png-128`);
      const launcherFolder = zip.folder('Launcher3-adapted');

      for (const file of launcherFiles) {
        launcherFolder?.file(file.path, file.content);
      }

      const batchSize = 10;
      for (let i = 0; i < exportItems.length; i += batchSize) {
        const batch = exportItems.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item) => {
            const adapted = await adaptIcon(item, settings, 128);
            svgFolder?.file(`${item.category}/${item.name}.svg`, adapted.svgString);
            const base64 = adapted.pngDataUrl.split(',')[1];
            if (base64) {
              pngFolder?.file(`${item.category}/${item.name}.png`, base64, {
                base64: true,
              });
            }
          })
        );
        setExportProgress({
          active: true,
          done: Math.min(exportItems.length, i + batch.length),
          total: exportItems.length,
        });
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${targetPack}-ios-squircle-launcher3-pack.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportProgress({ active: false, done: 0, total: 0 });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1360px] mx-auto px-6 py-3.5 flex items-center justify-between gap-8">
          <a
            href="#workbench"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('workbench');
            }}
            className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Frost × Launcher3 Adapter
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-400">
            {(
              [
                { id: 'workbench', label: 'Workbench' },
                { id: 'library', label: 'Icon Packs' },
                { id: 'launcher3', label: 'Launcher3 Code' },
                { id: 'geometry', label: 'iOS Geometry' },
              ] as const
            ).map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveTab(nav.id)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === nav.id
                    ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white'
                    : 'border-transparent hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportPack}
              disabled={exportProgress.active || loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <Package className="w-3.5 h-3.5" />
              {exportProgress.active
                ? `Exporting ${exportProgress.done}/${exportProgress.total}`
                : 'Export Adapted Pack'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1360px] mx-auto px-6 py-6 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white text-balance">
              iOS Continuous Squircle Icon Adapter
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span>
                {(totalIndexedIcons + customIcons.length).toLocaleString()} icons across Frost,
                Papirus, Colloid, Reversal, Tela &amp; Custom Apps
              </span>
              <span aria-hidden="true">·</span>
              <span>iOS r = 22.37% / smoothing 60%</span>
              <span aria-hidden="true">·</span>
              <span>ColorExtractor adaptive gradient + 135° bevel stroke</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex md:hidden items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'workbench', label: 'Workbench' },
                  { id: 'library', label: 'Packs' },
                  { id: 'launcher3', label: 'Launcher3' },
                  { id: 'geometry', label: 'Geometry' },
                ] as const
              ).map((nav) => (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => setActiveTab(nav.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                    activeTab === nav.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {nav.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setDarkMode((d) => !d)}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {darkMode ? 'Light UI' : 'Dark UI'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Indexing Frost, Papirus, Colloid, Reversal, Tela, and Launcher3 source files...
          </div>
        ) : error ? (
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-xl p-8 text-center">
            <div className="text-sm font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Verify the backend server is serving /api/packs, /api/icons, and /api/launcher3/files.
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'workbench' && (
              <WorkbenchView
                icon={selectedIcon}
                allSampleIcons={sampleIcons}
                settings={settings}
                onSettingsChange={setSettings}
                onSelectIcon={setSelectedIcon}
                onUploadCustomIcon={handleUploadCustomIcon}
              />
            )}

            {activeTab === 'library' && (
              <FrostLibraryView
                packs={packs}
                customIcons={customIcons}
                activePack={activePack}
                onActivePackChange={setActivePack}
                settings={settings}
                selectedIconId={selectedIcon.id}
                onSelectForWorkbench={(item) => {
                  setSelectedIcon(item);
                  setActiveTab('workbench');
                }}
              />
            )}

            {activeTab === 'launcher3' && (
              <Launcher3DiffView files={launcherFiles} />
            )}

            {activeTab === 'geometry' && <GeometryView settings={settings} />}
          </>
        )}
      </main>
    </div>
  );
}
