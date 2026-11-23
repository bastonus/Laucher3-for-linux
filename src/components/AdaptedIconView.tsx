import React, { useEffect, useMemo, useState } from 'react';
import { adaptIcon, RenderedAdaptation } from '../engine/iconAdapter';
import { AdapterSettings, FrostIconItem } from '../types/adapter';

const renderCache = new Map<string, RenderedAdaptation>();

export function buildSettingsCacheKey(settings: AdapterSettings): string {
  return [
    settings.cornerRadiusRatio.toFixed(4),
    settings.cornerSmoothing.toFixed(3),
    settings.scaleStrategy,
    settings.foregroundScale.toFixed(3),
    settings.backgroundMode,
    settings.customBgColor,
    settings.strokeWidth128.toFixed(2),
    settings.lightStrokeOpacity.toFixed(2),
    settings.shadowStrokeOpacity.toFixed(2),
    settings.stripFrostOuterShadow ? '1' : '0',
    settings.frostSeamlessPlate ? '1' : '0',
    settings.outerDropShadow ? '1' : '0',
  ].join('|');
}

interface AdaptedIconViewProps {
  icon: FrostIconItem;
  settings: AdapterSettings;
  size?: number;
  renderResolution?: number;
  className?: string;
  alt?: string;
  onAnalysisReady?: (result: RenderedAdaptation) => void;
}

export const AdaptedIconView: React.FC<AdaptedIconViewProps> = ({
  icon,
  settings,
  size = 64,
  renderResolution = 192,
  className = '',
  alt,
  onAnalysisReady,
}) => {
  const settingsKey = useMemo(() => buildSettingsCacheKey(settings), [settings]);
  const cacheKey = `${icon.id}::${icon.dataUrl ? icon.dataUrl.slice(0, 64) : icon.svg.length}::${renderResolution}::${settingsKey}`;

  const [rendered, setRendered] = useState<RenderedAdaptation | null>(
    () => renderCache.get(cacheKey) ?? null
  );

  useEffect(() => {
    const cached = renderCache.get(cacheKey);
    if (cached) {
      setRendered(cached);
      onAnalysisReady?.(cached);
      return;
    }

    let cancelled = false;
    adaptIcon(icon, settings, renderResolution)
      .then((res) => {
        if (cancelled) return;
        if (renderCache.size > 700) {
          const firstKey = renderCache.keys().next().value;
          if (firstKey) renderCache.delete(firstKey);
        }
        renderCache.set(cacheKey, res);
        setRendered(res);
        onAnalysisReady?.(res);
      })
      .catch(() => {
        // Fallback gracefully if an icon fails to rasterize
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, icon, settings, renderResolution, onAnalysisReady]);

  if (!rendered) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-[22%] bg-slate-200/70 dark:bg-slate-800/70 animate-pulse shrink-0 ${className}`}
      />
    );
  }

  return (
    <img
      src={rendered.pngDataUrl}
      alt={alt ?? icon.name}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`select-none object-contain shrink-0 ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};

export function getOriginalIconUrl(icon: FrostIconItem): string {
  if (icon.dataUrl) return icon.dataUrl;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(icon.svg)}`;
}
