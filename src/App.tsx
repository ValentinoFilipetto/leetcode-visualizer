import { useEffect, useMemo, useState } from 'react';
import data from './data/solutions.generated.json';
import type { Solution } from './types';
import { Sidebar } from './components/Sidebar';
import { SolutionView } from './components/SolutionView';
import { IconExternal, IconMenu, IconMoon, IconSun } from './components/icons';
import { tracers } from './tracers';

const JAVA_REPO = 'https://github.com/ValentinoFilipetto/java-leetcode-solutions';

const solutions = (data.solutions as Solution[]).slice().sort((a, b) => a.title.localeCompare(b.title));

function leetcodeUrl(s: Solution): string {
  return s.leetcodeSlug
    ? `https://leetcode.com/problems/${s.leetcodeSlug}/`
    : `https://leetcode.com/problemset/?search=${encodeURIComponent(s.title)}`;
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

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
    <div className="app">
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

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen((o) => !o)} title="Problems">
            <IconMenu />
          </button>
          <div style={{ minWidth: 0 }}>
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
            </div>
          </div>
          <div className="topbar-actions">
            <a className="link-btn" href={leetcodeUrl(solution)} target="_blank" rel="noreferrer">
              LeetCode <IconExternal />
            </a>
            <a
              className="link-btn"
              href={`${JAVA_REPO}/blob/main/${solution.sourcePath}`}
              target="_blank"
              rel="noreferrer"
            >
              Source <IconExternal />
            </a>
            <button
              className="icon-btn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </header>

        <SolutionView solution={solution} tracer={tracers[solution.id]} />
      </main>
    </div>
  );
}
