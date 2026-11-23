import React, { useCallback, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  RotateCcw,
  Upload,
} from 'lucide-react';
import {
  adaptIcon,
  RenderedAdaptation,
} from '../engine/iconAdapter';
import {
  AdapterSettings,
  BackgroundAdaptMode,
  DEFAULT_IOS_ADAPTER_SETTINGS,
  FrostIconItem,
  ScaleStrategy,
} from '../types/adapter';
import { AdaptedIconView, getOriginalIconUrl } from './AdaptedIconView';

type PreviewSurface = 'light' | 'dark' | 'wallpaper';

interface WorkbenchViewProps {
  icon: FrostIconItem;
  allSampleIcons: FrostIconItem[];
  settings: AdapterSettings;
  onSettingsChange: (next: AdapterSettings) => void;
  onSelectIcon: (icon: FrostIconItem) => void;
  onUploadCustomIcon: (item: FrostIconItem) => void;
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
  icon,
  allSampleIcons,
  settings,
  onSettingsChange,
  onSelectIcon,
  onUploadCustomIcon,
}) => {
  const [surface, setSurface] = useState<PreviewSurface>('light');
  const [analysisResult, setAnalysisResult] = useState<RenderedAdaptation | null>(null);
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalysisReady = useCallback((res: RenderedAdaptation) => {
    setAnalysisResult(res);
  }, []);

  const updateSetting = <K extends keyof AdapterSettings>(
    key: K,
    value: AdapterSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleFile = async (file: File) => {
    const cleanName = file.name.replace(/\.[^.]+$/, '');
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
      const text = await file.text();
      onUploadCustomIcon({
        id: `custom/${cleanName}-${Date.now()}`,
        name: cleanName,
        file: file.name,
        category: 'custom',
        family: 'custom-svg',
        svg: text,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUploadCustomIcon({
          id: `custom/${cleanName}-${Date.now()}`,
          name: cleanName,
          file: file.name,
          category: 'custom',
          family: 'custom-raster',
          svg: '',
          dataUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const handleDownloadSvg = async () => {
    const res = await adaptIcon(icon, settings, 256);
    const blob = new Blob([res.svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${icon.name}-ios-squircle.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPng = async (size: number) => {
    const res = await adaptIcon(icon, settings, size);
    const a = document.createElement('a');
    a.href = res.pngDataUrl;
    a.download = `${icon.name}-ios-squircle-${size}px.png`;
    a.click();
  };

  const handleCopySvg = async () => {
    const res = await adaptIcon(icon, settings, 256);
    await navigator.clipboard.writeText(res.svgString);
    setCopiedSvg(true);
    setTimeout(() => setCopiedSvg(false), 1800);
  };

  const surfaceClasses: Record<PreviewSurface, string> = {
    light: 'bg-[#FAFAFB] text-slate-900 border-slate-200',
    dark: 'bg-[#1E1E22] text-slate-100 border-slate-800',
    wallpaper:
      'bg-gradient-to-br from-sky-900 via-indigo-900 to-slate-950 text-white border-slate-800',
  };

  const analysis = analysisResult?.analysis;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Inspection Viewport */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        {/* Header Bar & Quick Switcher */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="capitalize">{icon.category}</span>
                <span aria-hidden="true">·</span>
                <span>{icon.family} family</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">iOS r = {(settings.cornerRadiusRatio * 100).toFixed(2)}%</span>
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 truncate mt-0.5">
                {icon.name}
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopySvg}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedSvg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSvg ? 'Copied SVG' : 'Copy SVG'}
              </button>
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                SVG
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPng(512)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                PNG 512px
              </button>
            </div>
          </div>

          {/* Surface Switcher & Sample Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'light', label: 'Light #FAFAFB' },
                  { id: 'dark', label: 'Dark #1E1E22' },
                  { id: 'wallpaper', label: 'Wallpaper' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSurface(item.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    surface === item.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
              {allSampleIcons.slice(0, 7).map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => onSelectIcon(sample)}
                  title={sample.name}
                  className={`p-1 rounded-lg border transition-all shrink-0 ${
                    sample.id === icon.id
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40'
                      : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <AdaptedIconView
                    icon={sample}
                    settings={settings}
                    size={28}
                    renderResolution={96}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Before vs After Canvas */}
          <div
            className={`rounded-xl border p-6 sm:p-8 transition-colors ${surfaceClasses[surface]}`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
              <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-medium opacity-70">
                  Original Source
                </span>
                <div className="w-40 h-40 flex items-center justify-center">
                  <img
                    src={getOriginalIconUrl(icon)}
                    alt={`${icon.name} original`}
                    className="w-32 h-32 object-contain select-none"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-xs font-mono opacity-60 tabular-nums">
                  {icon.category === 'status' ? '16×16 symbolic' : '128×128 raw'}
                </span>
              </div>

              <div className="flex flex-col items-center gap-3">
                <span className="text-xs font-medium opacity-70">
                  Adapted iOS Squircle
                </span>
                <div className="w-40 h-40 flex items-center justify-center">
                  <AdaptedIconView
                    icon={icon}
                    settings={settings}
                    size={144}
                    renderResolution={384}
                    onAnalysisReady={handleAnalysisReady}
                  />
                </div>
                <span className="text-xs font-mono opacity-60 tabular-nums">
                  r={settings.cornerRadiusRatio.toFixed(4)} · stroke 135°
                </span>
              </div>
            </div>

            {/* Multi-Size Density Strip */}
            <div className="mt-8 pt-6 border-t border-current/10 flex flex-wrap items-end justify-center gap-6">
              {[128, 64, 48, 32, 24, 16].map((sz) => (
                <div key={sz} className="flex flex-col items-center gap-2">
                  <AdaptedIconView
                    icon={icon}
                    settings={settings}
                    size={sz}
                    renderResolution={Math.max(128, sz * 2)}
                  />
                  <span className="text-[11px] font-mono opacity-65 tabular-nums">
                    {sz}px
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline Telemetry Readout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Extracted Hue</div>
              <div className="mt-1 flex items-center gap-2 font-mono text-sm font-medium tabular-nums">
                <span
                  className="w-3.5 h-3.5 rounded border border-black/10 shrink-0"
                  style={{ backgroundColor: analysis?.dominantHex ?? '#94A3B8' }}
                />
                <span>{analysis?.dominantHex ?? '—'}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Adapted BG Gradient</div>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-xs font-medium tabular-nums">
                <span
                  className="w-3.5 h-3.5 rounded border border-black/10 shrink-0"
                  style={{
                    background: analysis
                      ? `linear-gradient(135deg, ${analysis.bgLightHex}, ${analysis.bgDeepHex})`
                      : '#CBD5E1',
                  }}
                />
                <span className="truncate">
                  {analysis ? `${analysis.bgLightHex} → ${analysis.bgDeepHex}` : '—'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Shape &amp; Edge Mode
              </div>
              <div className="mt-1 font-mono text-sm font-medium tabular-nums capitalize">
                {analysis ? analysis.detectedShape : '—'}
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5 lowercase">
                  {analysis
                    ? analysis.fullBleedApplied
                      ? `· edge-cut ${(analysis.effectiveScale * 100).toFixed(0)}%`
                      : `· inset ${(analysis.effectiveScale * 100).toFixed(0)}%`
                    : ''}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">Diagonal Stroke</div>
              <div className="mt-1 font-mono text-sm font-medium tabular-nums">
                {settings.strokeWidth128.toFixed(1)}px
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5">
                  {Math.round(settings.lightStrokeOpacity * 100)}% / {Math.round(settings.shadowStrokeOpacity * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Icon Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border border-dashed p-5 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/30'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Adapt Any Custom Icon
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Drop any SVG, PNG, or WebP app icon to normalize it through Launcher3&apos;s iOS squircle pipeline.
              </div>
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/svg+xml,image/png,image/webp,image/jpeg,.svg,.png,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              Choose File
            </button>
          </div>
        </div>
      </div>

      {/* Right Parameter Controls */}
      <aside className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Adapter Parameters
          </h3>
          <button
            type="button"
            onClick={() => onSettingsChange(DEFAULT_IOS_ADAPTER_SETTINGS)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            Reset iOS Defaults
          </button>
        </div>

        {/* 1. iOS Squircle Geometry */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            iOS Squircle Shape
          </div>

          <label className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Corner Radius Ratio</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {(settings.cornerRadiusRatio * 100).toFixed(2)}%
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.35}
              step={0.0001}
              value={settings.cornerRadiusRatio}
              onChange={(e) => updateSetting('cornerRadiusRatio', Number(e.target.value))}
              className="w-full accent-slate-900 dark:accent-white"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Continuous Smoothing</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {Math.round(settings.cornerSmoothing * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={settings.cornerSmoothing}
              onChange={(e) => updateSetting('cornerSmoothing', Number(e.target.value))}
              className="w-full accent-slate-900 dark:accent-white"
            />
          </label>
        </div>

        {/* 2. Color-Adapted Background */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Color-Adapted Background
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: 'adaptive-tint', label: 'Adaptive Tint' },
                { id: 'adaptive-deep', label: 'Adaptive Deep' },
                { id: 'frosted-glass', label: 'Frosted Pastel' },
                { id: 'custom', label: 'Custom Solid' },
              ] as Array<{ id: BackgroundAdaptMode; label: string }>
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => updateSetting('backgroundMode', mode.id)}
                className={`px-2.5 py-2 text-xs font-medium rounded-lg border text-left transition-colors whitespace-nowrap truncate ${
                  settings.backgroundMode === mode.id
                    ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {settings.backgroundMode === 'custom' && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-slate-600 dark:text-slate-400">Base Tint</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.customBgColor}
                  onChange={(e) => updateSetting('customBgColor', e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="font-mono text-xs uppercase tabular-nums">
                  {settings.customBgColor}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3. Diagonal Light & Shadow Stroke */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Diagonal Light &amp; Shadow Stroke (135°)
          </div>

          <label className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Stroke Weight (@128px)</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {settings.strokeWidth128.toFixed(1)}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={0.25}
              value={settings.strokeWidth128}
              onChange={(e) => updateSetting('strokeWidth128', Number(e.target.value))}
              className="w-full accent-slate-900 dark:accent-white"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Top-Left Highlight</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {Math.round(settings.lightStrokeOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={settings.lightStrokeOpacity}
              onChange={(e) => updateSetting('lightStrokeOpacity', Number(e.target.value))}
              className="w-full accent-slate-900 dark:accent-white"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Bottom-Right Shadow</span>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {Math.round(settings.shadowStrokeOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.02}
              value={settings.shadowStrokeOpacity}
              onChange={(e) => updateSetting('shadowStrokeOpacity', Number(e.target.value))}
              className="w-full accent-slate-900 dark:accent-white"
            />
          </label>
        </div>

        {/* 4. Launcher3 Normalizer & Frost Handling */}
        <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Normalization &amp; Frost Theme Rules
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                { id: 'launcher3-normalizer', label: 'Normalizer' },
                { id: 'fixed-legacy', label: 'Fixed Scale' },
                { id: 'custom', label: 'Manual' },
              ] as Array<{ id: ScaleStrategy; label: string }>
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => updateSetting('scaleStrategy', s.id)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  settings.scaleStrategy === s.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {settings.scaleStrategy === 'custom' && (
            <label className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Foreground Scale</span>
                <span className="font-mono tabular-nums">
                  {Math.round(settings.foregroundScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.08}
                step={0.01}
                value={settings.foregroundScale}
                onChange={(e) => updateSetting('foregroundScale', Number(e.target.value))}
                className="w-full accent-slate-900 dark:accent-white"
              />
            </label>
          )}

          <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Strip Frost outer shadow &amp; glow
            </span>
            <input
              type="checkbox"
              checked={settings.stripFrostOuterShadow}
              onChange={(e) => updateSetting('stripFrostOuterShadow', e.target.checked)}
              className="w-4 h-4 accent-slate-900 dark:accent-white rounded"
            />
          </label>

          <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Seamless Frost glass plate inside squircle
            </span>
            <input
              type="checkbox"
              checked={settings.frostSeamlessPlate}
              onChange={(e) => updateSetting('frostSeamlessPlate', e.target.checked)}
              className="w-4 h-4 accent-slate-900 dark:accent-white rounded"
            />
          </label>

          <label className="flex items-center justify-between gap-3 py-1 cursor-pointer">
            <span className="text-xs text-slate-700 dark:text-slate-300">
              Launcher3 ShadowGenerator drop shadow
            </span>
            <input
              type="checkbox"
              checked={settings.outerDropShadow}
              onChange={(e) => updateSetting('outerDropShadow', e.target.checked)}
              className="w-4 h-4 accent-slate-900 dark:accent-white rounded"
            />
          </label>
        </div>
      </aside>
    </div>
  );
};
