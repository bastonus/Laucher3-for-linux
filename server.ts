import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FROST_SRC_DIR = path.resolve(__dirname, 'external_repos/frost-icon-theme/src');
const PACKS_DIR = path.resolve(__dirname, 'external_repos/packs');
const LAUNCHER3_DIR = path.resolve(__dirname, 'external_repos/Launcher3');

type IconPackId = 'frost' | 'papirus' | 'colloid' | 'reversal' | 'tela';
type IconCategory = 'apps' | 'places' | 'mimetypes' | 'status';

interface IndexedIconMeta {
  id: string;
  name: string;
  file: string;
  pack: IconPackId;
  category: IconCategory;
  family: string;
  absPath: string;
}

interface PackDescriptor {
  id: IconPackId;
  label: string;
  description: string;
  dirs: Array<{ category: IconCategory; dir: string }>;
}

const PACK_DESCRIPTORS: PackDescriptor[] = [
  {
    id: 'frost',
    label: 'Frost',
    description: 'Frosted-glass icon theme (apps, folders, mimetypes, symbolic status)',
    dirs: [
      { category: 'apps', dir: path.join(FROST_SRC_DIR, 'apps') },
      { category: 'places', dir: path.join(FROST_SRC_DIR, 'places') },
      { category: 'mimetypes', dir: path.join(FROST_SRC_DIR, 'mimetypes') },
      { category: 'status', dir: path.join(FROST_SRC_DIR, 'status') },
    ],
  },
  {
    id: 'papirus',
    label: 'Papirus',
    description: 'Material-inspired flat Linux icon theme (64×64 apps & places)',
    dirs: [
      { category: 'apps', dir: path.join(PACKS_DIR, 'papirus/Papirus/64x64/apps') },
      { category: 'places', dir: path.join(PACKS_DIR, 'papirus/Papirus/64x64/places') },
    ],
  },
  {
    id: 'colloid',
    label: 'Colloid',
    description: 'Clean macOS/GNOME geometric scalable icon theme',
    dirs: [
      { category: 'apps', dir: path.join(PACKS_DIR, 'colloid/src/apps/scalable') },
      { category: 'places', dir: path.join(PACKS_DIR, 'colloid/src/places/scalable') },
    ],
  },
  {
    id: 'reversal',
    label: 'Reversal',
    description: 'Colorful circular & gradient scalable icon pack',
    dirs: [
      { category: 'apps', dir: path.join(PACKS_DIR, 'reversal/src/apps/scalable') },
      { category: 'places', dir: path.join(PACKS_DIR, 'reversal/src/places/scalable') },
    ],
  },
  {
    id: 'tela',
    label: 'Tela',
    description: 'Flat colorful scalable icon theme with crisp silhouettes',
    dirs: [
      { category: 'apps', dir: path.join(PACKS_DIR, 'tela/src/scalable/apps') },
      { category: 'places', dir: path.join(PACKS_DIR, 'tela/src/scalable/places') },
    ],
  },
];

function detectFamily(pack: IconPackId, category: IconCategory, fileName: string): string {
  if (pack === 'frost') {
    if (category === 'status') return 'symbolic';
    if (category === 'mimetypes') return 'sheet';
    if (category === 'places' && fileName.includes('folder')) return 'folder';
    if (category === 'apps') return 'app';
    return 'glass';
  }
  return `${pack}-${category === 'places' ? 'folder' : 'app'}`;
}

function buildIconIndex(): IndexedIconMeta[] {
  const index: IndexedIconMeta[] = [];
  for (const pack of PACK_DESCRIPTORS) {
    for (const { category, dir } of pack.dirs) {
      if (!fs.existsSync(dir)) continue;
      let files: string[] = [];
      try {
        files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.svg') && !f.endsWith('.16.svg'))
          .sort();
      } catch {
        continue;
      }

      for (const file of files) {
        const absPath = path.join(dir, file);
        try {
          const stat = fs.statSync(absPath);
          if (!stat.isFile()) continue;
        } catch {
          continue;
        }
        const name = file.replace(/\.svg$/, '');
        index.push({
          id: `${pack.id}/${category}/${name}`,
          name,
          file,
          pack: pack.id,
          category,
          family: detectFamily(pack.id, category, file),
          absPath,
        });
      }
    }
  }
  return index;
}

interface LauncherFileEntry {
  path: string;
  label: string;
  status: 'created' | 'modified' | 'reference';
  summary: string;
  content: string;
}

function loadLauncher3Files(): LauncherFileEntry[] {
  const specs: Array<{
    relPath: string;
    label: string;
    status: 'created' | 'modified' | 'reference';
    summary: string;
  }> = [
    {
      relPath: 'src/com/android/launcher3/graphics/IosSquircleAdapter.java',
      label: 'IosSquircleAdapter.java',
      status: 'created',
      summary:
        'Exact iOS continuous-curvature squircle path (r=0.2237, smoothing=0.60), ColorExtractor-driven adaptive gradient background, and 135° diagonal light-to-shadow inner stroke.',
    },
    {
      relPath: 'src/com/android/launcher3/graphics/LauncherIcons.java',
      label: 'LauncherIcons.java',
      status: 'modified',
      summary:
        'Routes createBadgedIconBitmap and normalizeAndWrapToAdaptiveIcon through IosSquircleAdapter so any legacy, adaptive, or themed icon becomes an iOS squircle.',
    },
    {
      relPath: 'res/values/config.xml',
      label: 'res/values/config.xml',
      status: 'modified',
      summary:
        'Replaces the legacy pebble squircle mask in icon_shape_override_paths_values with the normalized 100×100 iOS continuous squircle SVG path.',
    },
    {
      relPath: 'src/com/android/launcher3/graphics/IconShapeOverride.java',
      label: 'IconShapeOverride.java',
      status: 'modified',
      summary:
        'Defaults getAppliedValue() to IosSquircleAdapter.IOS_SQUIRCLE_MASK_PATH_DATA when no manual shape override is set.',
    },
    {
      relPath: 'src/com/android/launcher3/graphics/IconNormalizer.java',
      label: 'IconNormalizer.java',
      status: 'reference',
      summary:
        'Convex-hull visual area normalizer used to compute balanced foreground scale inside the iOS squircle safe zone.',
    },
    {
      relPath: 'src/com/android/launcher3/graphics/ColorExtractor.java',
      label: 'ColorExtractor.java',
      status: 'reference',
      summary:
        '360-bucket hue histogram weighted by saturation and value used to derive color-adapted background gradients.',
    },
  ];

  const results: LauncherFileEntry[] = [];
  for (const spec of specs) {
    const absPath = path.join(LAUNCHER3_DIR, spec.relPath);
    if (!fs.existsSync(absPath)) continue;
    results.push({
      path: spec.relPath,
      label: spec.label,
      status: spec.status,
      summary: spec.summary,
      content: fs.readFileSync(absPath, 'utf-8'),
    });
  }
  return results;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  let iconIndex = buildIconIndex();

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      iconCount: iconIndex.length,
    });
  });

  app.get('/api/packs', (_req, res) => {
    if (iconIndex.length === 0) iconIndex = buildIconIndex();
    const packs = PACK_DESCRIPTORS.map((desc) => {
      const packItems = iconIndex.filter((i) => i.pack === desc.id);
      const categories: Record<string, number> = {};
      for (const item of packItems) {
        categories[item.category] = (categories[item.category] ?? 0) + 1;
      }
      return {
        id: desc.id,
        label: desc.label,
        description: desc.description,
        total: packItems.length,
        categories,
      };
    });
    res.json({
      totalIcons: iconIndex.length,
      packs,
    });
  });

  app.get('/api/icons', (req, res) => {
    if (iconIndex.length === 0) iconIndex = buildIconIndex();

    const pack = typeof req.query.pack === 'string' ? req.query.pack : 'frost';
    const category = typeof req.query.category === 'string' ? req.query.category : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit = Math.min(400, Math.max(1, Number(req.query.limit) || 72));
    const includeSvg = req.query.includeSvg !== '0';

    let filtered = iconIndex;
    if (pack !== 'all') {
      filtered = filtered.filter((item) => item.pack === pack);
    }

    const counts = {
      all: filtered.length,
      apps: filtered.filter((i) => i.category === 'apps').length,
      places: filtered.filter((i) => i.category === 'places').length,
      mimetypes: filtered.filter((i) => i.category === 'mimetypes').length,
      status: filtered.filter((i) => i.category === 'status').length,
    };

    if (category !== 'all') {
      filtered = filtered.filter((item) => item.category === category);
    }
    if (q) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.pack.toLowerCase().includes(q) ||
          item.family.toLowerCase().includes(q)
      );
    }

    const page = filtered.slice(offset, offset + limit);
    const icons = page.map((item) => ({
      id: item.id,
      name: item.name,
      file: item.file,
      pack: item.pack,
      category: item.category,
      family: item.family,
      svg: includeSvg ? fs.readFileSync(item.absPath, 'utf-8') : '',
    }));

    res.json({
      total: filtered.length,
      offset,
      limit,
      counts,
      icons,
    });
  });

  app.get('/api/launcher3/files', (_req, res) => {
    const files = loadLauncher3Files();
    res.json({ files });
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Frost × Launcher3 Adapter server listening on http://0.0.0.0:${PORT} (${iconIndex.length} icons indexed)`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
