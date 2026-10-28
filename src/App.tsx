import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import data from './data/solutions.generated.json';
import type { Solution } from './types';
import { ResizeHandle } from './components/ResizeHandle';
import { Sidebar } from './components/Sidebar';
import { SolutionView } from './components/SolutionView';
import { IconCode, IconExternal, IconMenu, IconMoon, IconSidebar, IconSun } from './components/icons';
import { tracers } from './tracers';

const JAVA_REPO = 'https://github.com/ValentinoFilipetto/java-leetcode-solutions';

const solutions = (data.solutions as Solution[]).slice().sort((a, b) => a.title.localeCompare(b.title));

const MIN_SIDEBAR = 220;
const MAX_SIDEBAR = 480;
/** Room the workspace needs beside the sidebar: both panel minimums plus gutter and padding. */
const MIN_MAIN = 720;

/** Rendered twice: in the topbar on desktop, inside the meta strip on mobile. */
function SolutionLinks({ solution }: { solution: Solution }) {
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
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('theme') as 'dark' | 'light') ?? 'dark',
  );
  const [menuOpen, setMenuOpen] = useState(false);
  // Mobile only: the code panel is collapsed by default so the stage gets the full width.
  const [showCode, setShowCode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#10151f' : '#ffffff');
  }, [theme]);

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

      <main className="main">
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
            <button
              className="icon-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </header>

        <SolutionView solution={solution} tracer={tracers[solution.id]} showCode={showCode} />
      </main>
    </div>
  );
}
