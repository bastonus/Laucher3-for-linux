import React, { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { Launcher3SourceFile } from '../types/adapter';

interface Launcher3DiffViewProps {
  files: Launcher3SourceFile[];
}

export const Launcher3DiffView: React.FC<Launcher3DiffViewProps> = ({ files }) => {
  const [activePath, setActivePath] = useState<string>(
    files[0]?.path ?? 'src/com/android/launcher3/graphics/IosSquircleAdapter.java'
  );
  const [copied, setCopied] = useState(false);

  const activeFile = files.find((f) => f.path === activePath) ?? files[0];

  const handleCopy = async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.label;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (files.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">
        Loading adapted Launcher3 source files...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-2">
        <div className="px-2 pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Adapted Launcher3 Files
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Patched directly inside PoarryScript/Launcher3
          </p>
        </div>

        <div className="flex flex-col gap-1 mt-1">
          {files.map((file) => {
            const isActive = file.path === activeFile?.path;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setActivePath(file.path)}
                className={`text-left p-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium truncate">
                    {file.label}
                  </span>
                  <span
                    className={`text-[11px] font-medium shrink-0 ${
                      isActive
                        ? 'opacity-80'
                        : file.status === 'created'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : file.status === 'modified'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {file.status}
                  </span>
                </div>
                <div
                  className={`text-[11px] mt-1 line-clamp-2 ${
                    isActive ? 'opacity-80' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {file.summary}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {activeFile && (
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate">
                {activeFile.path}
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {activeFile.summary}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>

          <pre className="p-5 overflow-x-auto text-xs leading-relaxed font-mono text-slate-800 dark:text-slate-200 bg-slate-50/70 dark:bg-slate-950/60 max-h-[680px]">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      )}
    </div>
  );
};
