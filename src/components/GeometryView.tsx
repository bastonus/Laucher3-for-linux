import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  buildIosSquircleSvgPath,
  buildStandardRoundedRectPath,
  computeSquircleCornerGeometry,
  IOS_MASK_PATH_100,
  LAUNCHER3_LEGACY_SQUIRCLE_100,
} from '../engine/iosSquircle';
import { AdapterSettings } from '../types/adapter';

interface GeometryViewProps {
  settings: AdapterSettings;
}

export const GeometryView: React.FC<GeometryViewProps> = ({ settings }) => {
  const [showLegacyOverlay, setShowLegacyOverlay] = useState(true);
  const [showRoundedOverlay, setShowRoundedOverlay] = useState(true);
  const [copiedMask, setCopiedMask] = useState(false);

  const iosPath100 = buildIosSquircleSvgPath(
    100,
    settings.cornerRadiusRatio,
    settings.cornerSmoothing
  );
  const roundedRect100 = buildStandardRoundedRectPath(100, settings.cornerRadiusRatio);
  const geom = computeSquircleCornerGeometry(
    100,
    settings.cornerRadiusRatio,
    settings.cornerSmoothing
  );

  const handleCopyMask = async () => {
    await navigator.clipboard.writeText(iosPath100);
    setCopiedMask(true);
    setTimeout(() => setCopiedMask(false), 1800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              iOS Continuous Curvature vs. Launcher3 Legacy Squircle
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Normalized 100×100 Android config_icon_mask coordinate space
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showRoundedOverlay}
                onChange={(e) => setShowRoundedOverlay(e.target.checked)}
                className="accent-amber-500"
              />
              Circular Rect (r={(settings.cornerRadiusRatio * 100).toFixed(1)}%)
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showLegacyOverlay}
                onChange={(e) => setShowLegacyOverlay(e.target.checked)}
                className="accent-rose-500"
              />
              Launcher3 Legacy
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-6 flex items-center justify-center">
          <svg
            viewBox="-12 -12 124 124"
            className="w-full max-w-[380px] aspect-square"
          >
            <defs>
              <linearGradient id="geom-stroke" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              <pattern id="grid-10" width="10" height="10" patternUnits="userSpaceOnUse">
                <path
                  d="M 10 0 L 0 0 0 10"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity="0.08"
                  strokeWidth="0.4"
                />
              </pattern>
            </defs>

            <rect x="0" y="0" width="100" height="100" fill="url(#grid-10)" />
            <rect
              x="0"
              y="0"
              width="100"
              height="100"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.16"
              strokeDasharray="2 2"
              strokeWidth="0.6"
            />

            {/* 135 deg diagonal light/shadow axis */}
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeDasharray="1.5 2"
              strokeWidth="0.7"
            />

            {showLegacyOverlay && (
              <path
                d={LAUNCHER3_LEGACY_SQUIRCLE_100}
                fill="none"
                stroke="#F43F5E"
                strokeWidth="1.2"
                strokeDasharray="2.5 2"
              />
            )}

            {showRoundedOverlay && (
              <path
                d={roundedRect100}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.1"
                strokeDasharray="1.2 1.8"
              />
            )}

            <path
              d={iosPath100}
              fill="#3B82F6"
              fillOpacity="0.09"
              stroke="url(#geom-stroke)"
              strokeWidth="1.8"
            />

            {/* Key transition anchors on top-right corner */}
            <circle cx={100 - geom.p} cy={0} r="1.7" fill="#2563EB" />
            <circle cx={100 - geom.p + geom.a + geom.b + geom.c} cy={geom.d} r="1.7" fill="#10B981" />
            <circle cx={100 - geom.d} cy={geom.arcEndOffset} r="1.7" fill="#10B981" />
            <circle cx={100} cy={geom.p} r="1.7" fill="#2563EB" />
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-blue-600 inline-block" />
            <span>Exact iOS Continuous Squircle</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-amber-500 inline-block" />
            <span>Standard Circular Rect</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-0.5 bg-rose-500 inline-block" />
            <span>Old Launcher3 Pebble Squircle</span>
          </div>
        </div>
      </div>

      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Exact iOS Shape Parameters (100×100 Grid)
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {[
              ['Corner Radius (r)', `${geom.r.toFixed(3)} units (${(settings.cornerRadiusRatio * 100).toFixed(2)}%)`],
              ['Continuous Smoothing (s)', `${Math.round(settings.cornerSmoothing * 100)}%`],
              ['Total Corner Span (p)', `${geom.p.toFixed(3)} units`],
              ['Straight Edge Length', `${(100 - 2 * geom.p).toFixed(3)} units`],
              ['Circular Arc Sweep', `${geom.arcMeasure.toFixed(2)}°`],
              ['Transition Bezier (a / b)', `${geom.a.toFixed(3)} / ${geom.b.toFixed(3)}`],
              ['Diagonal Stroke Vector', '135° (0,0 → 100,100)'],
            ].map(([label, val]) => (
              <div key={label} className="py-2.5 flex items-center justify-between gap-4">
                <span className="text-slate-600 dark:text-slate-400">{label}</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Android config_icon_mask PathData
            </h3>
            <button
              type="button"
              onClick={handleCopyMask}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {copiedMask ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copiedMask ? 'Copied' : 'Copy Path'}
            </button>
          </div>
          <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
            {iosPath100 === IOS_MASK_PATH_100 ? IOS_MASK_PATH_100 : iosPath100}
          </pre>
        </div>
      </div>
    </div>
  );
};
