import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { codeLoaders, solutions as allSolutions } from 'virtual:solutions';
import type { Solution, SolutionMeta } from './types';
import { ResizeHandle } from './components/ResizeHandle';
import { Sidebar } from './components/Sidebar';
import { SolutionView } from './components/SolutionView';
import { IconCode, IconExternal, IconMenu, IconSidebar } from './components/icons';
import { tracers } from './tracers';

const JAVA_REPO = 'https://github.com/ValentinoFilipetto/java-leetcode-solutions';

const solutions = allSolutions.slice().sort((a, b) => a.title.localeCompare(b.title));

/**
 * The selected solution with its source, which lives in a per-solution chunk. Until the chunk for a
 * new selection arrives this keeps returning the previous one, so SolutionView stays mounted
 * (and keeps its player settings) instead of flashing empty; it is null only on first load.
 */
function useLoadedSolution(meta: SolutionMeta): Solution | null {
  const [loaded, setLoaded] = useState<Solution | null>(null);
  useEffect(() => {
    let current = true;
    codeLoaders[meta.id]().then((mod) => {
      if (current) setLoaded({ ...meta, code: mod.default });
    });
    return () => {
      current = false;
    };
  }, [meta]);
  return loaded;
}

type ThemePref = 'system' | 'light' | 'dark';
const THEME_OPTIONS: [ThemePref, string][] = [
  ['dark', 'Dark'],
  ['light', 'Light'],
  ['system', 'System'],
];

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Tracks the OS colour scheme live, so "System" follows it without a reload. */
function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

const MIN_SIDEBAR = 220;
const MAX_SIDEBAR = 480;
/** Room the workspace needs beside the sidebar: both panel minimums plus gutter and padding. */
const MIN_MAIN = 720;

/** Rendered twice: in the topbar on desktop, inside the meta strip on mobile. */
function SolutionLinks({ solution }: { solution: SolutionMeta }) {
  return (
    <a
      className="link-btn"
      href={`${JAVA_REPO}/blob/main/${solution.sourcePath}`}
      target="_blank"
      rel="noreferrer"
    >
      Source <IconExternal />
    </a>
  );
}

function idFromHash(): string | null {
  const raw = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
  return solutions.some((s) => s.id === raw) ? raw : null;
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string>(
    () => idFromHash() ?? solutions.find((s) => tracers[s.id])?.id ?? solutions[0].id,
  );
  const [themePref, setThemePref] = useState<ThemePref>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
  });
  const systemDark = useSystemDark();
  const theme = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;
  const [menuOpen, setMenuOpen] = useState(false);
  // Mobile only: the code panel is collapsed by default so the stage gets the full width.
  const [showCode, setShowCode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#10151f' : '#ffffff');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('theme', themePref);
  }, [themePref]);

  const [sidebarWidth, setSidebarWidth] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem('sidebarWidth'));
    return saved > 0 ? saved : null;
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (sidebarWidth === null) localStorage.removeItem('sidebarWidth');
    else localStorage.setItem('sidebarWidth', String(Math.round(sidebarWidth)));
  }, [sidebarWidth]);

  useEffect(() => {
    window.location.hash = `/${selectedId}`;
  }, [selectedId]);

  useEffect(() => {
    const onHash = () => {
      const id = idFromHash();
      if (id && id !== selectedId) setSelectedId(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [selectedId]);

  const solution = useMemo(
    () => solutions.find((s) => s.id === selectedId) ?? solutions[0],
    [selectedId],
  );
  const loaded = useLoadedSolution(solution);

  return (
    <div
      className={`app${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
      style={
        sidebarWidth === null
          ? undefined
          // CSS re-clamps it, so shrinking the window never squeezes the workspace below MIN_MAIN.
          : ({
              '--sidebar-track': `clamp(${MIN_SIDEBAR}px, min(${sidebarWidth}px, calc(100% - ${MIN_MAIN}px)), ${MAX_SIDEBAR}px)`,
            } as CSSProperties)
      }
    >
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}
      <Sidebar
        className={menuOpen ? 'open' : ''}
        solutions={solutions}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          setMenuOpen(false);
        }}
      />
      <ResizeHandle
        className="sidebar-handle"
        label="Resize problem list"
        width={() => document.querySelector<HTMLElement>('.sidebar')?.offsetWidth ?? MIN_SIDEBAR}
        onResize={(px) =>
          setSidebarWidth(Math.max(MIN_SIDEBAR, Math.min(px, MAX_SIDEBAR, window.innerWidth - MIN_MAIN)))
        }
        onReset={() => setSidebarWidth(null)}
      />

      {/* data-solution-id names what SolutionView is showing, which lags selectedId while code loads. */}
      <main className="main" data-solution-id={loaded?.id}>
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} title="Problems">
            <IconMenu />
          </button>
          <button
            className="icon-btn collapse-btn"
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={sidebarCollapsed ? 'Show problem list' : 'Hide problem list'}
          >
            <IconSidebar />
          </button>
          <div className="title-block">
            <h1>
              {solution.leetcodeNumber !== null && (
                <span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>{solution.leetcodeNumber}. </span>
              )}
              {solution.title}
            </h1>
            <div className="meta-row">
              <span className={`tag ${solution.difficulty}`}>{solution.difficulty}</span>
              <span className="tag">{solution.pattern || solution.categoryLabel}</span>
              {solution.time && <span className="tag mono">time {solution.time}</span>}
              {solution.space && <span className="tag mono">space {solution.space}</span>}
              <span className="mobile-links">
                <SolutionLinks solution={solution} />
              </span>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="desktop-links">
              <SolutionLinks solution={solution} />
            </span>
            <button
              className={`icon-btn code-btn${showCode ? ' on' : ''}`}
              onClick={() => setShowCode((c) => !c)}
              aria-pressed={showCode}
              title={showCode ? 'Show the visualization' : 'Show the Java source'}
            >
              <IconCode />
            </button>
            <select
              className="theme-select"
              value={themePref}
              onChange={(e) => setThemePref(e.target.value as ThemePref)}
              aria-label="Theme"
              title="Theme"
            >
              {THEME_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {loaded && <SolutionView solution={loaded} tracer={tracers[loaded.id]} showCode={showCode} />}
      </main>
    </div>
  );
}
