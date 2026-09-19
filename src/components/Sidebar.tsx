import { useMemo, useState } from 'react';
import type { Solution } from '../types';
import { IconSearch } from './icons';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export function Sidebar({
  solutions,
  selectedId,
  onSelect,
  className = '',
}: {
  solutions: Solution[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = solutions.filter((s) => {
      if (difficulty && s.difficulty !== difficulty) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.categoryLabel.toLowerCase().includes(q) ||
        s.pattern.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
      );
    });
    const byCategory = new Map<string, Solution[]>();
    for (const s of filtered) {
      const list = byCategory.get(s.categoryLabel) ?? [];
      list.push(s);
      byCategory.set(s.categoryLabel, list);
    }
    return [...byCategory.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, list]) => [label, list.sort((a, b) => a.title.localeCompare(b.title))] as const);
  }, [solutions, query, difficulty]);

  const count = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <aside className={`sidebar ${className}`}>
      <div className="brand">
        <div className="brand-mark">◎</div>
        <div>
          <div className="brand-title">Algorithm Visualizer</div>
          <div className="brand-sub">{solutions.length} Java solutions</div>
        </div>
      </div>

      <div className="search-wrap">
        <span className="search-icon">
          <IconSearch />
        </span>
        <input
          className="search"
          placeholder="Search problems…  (/)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-search-input
        />
      </div>

      <div className="filters">
        <button className={`chip${difficulty === null ? ' on' : ''}`} onClick={() => setDifficulty(null)}>
          All
        </button>
        {DIFFICULTIES.map((d) => (
          <button
            key={d}
            className={`chip${difficulty === d ? ' on' : ''}`}
            onClick={() => setDifficulty(difficulty === d ? null : d)}
          >
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <nav className="solution-list">
        {count === 0 && <div className="no-results">No problems match “{query}”.</div>}
        {groups.map(([label, list]) => (
          <div key={label}>
            <div className="group-label">
              {label} · {list.length}
            </div>
            {list.map((s) => (
              <button
                key={s.id}
                className={`sol-item${s.id === selectedId ? ' on' : ''}`}
                onClick={() => onSelect(s.id)}
              >
                <span className={`dot ${s.difficulty}`} />
                <span className="sol-item-title">{s.title}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
