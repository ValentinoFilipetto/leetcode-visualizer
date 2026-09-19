import type {
  ArrayViz,
  BarsViz,
  CellState,
  GridViz,
  IntervalsViz,
  MapViz,
  Pointer,
  StackViz,
  TextViz,
} from '../../types';

export function stateClass(state?: CellState): string {
  return state && state !== 'idle' ? ` s-${state}` : '';
}

function PointerChips({ pointers, below }: { pointers: Pointer[]; below?: boolean }) {
  if (pointers.length === 0) return null;
  return (
    <div className={`pointer-stack${below ? ' below' : ''}`}>
      {pointers.map((p) => (
        <span key={p.name} className={`pointer-chip t${p.tone ?? 1}`}>
          {p.name}
        </span>
      ))}
    </div>
  );
}

export function ArrayView({ viz }: { viz: ArrayViz }) {
  const { values, states = [], pointers = [], labels = [], window: win } = viz;
  const indexed = viz.indexed !== false;
  const above = pointers.filter((p) => p.above !== false);
  const below = pointers.filter((p) => p.above === false);

  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      {values.length === 0 ? (
        <div className="viz-empty">empty</div>
      ) : (
        <div className="array-viz" style={below.length ? { paddingBottom: 22 } : undefined}>
          {values.map((v, i) => {
            const inWindow = win && i >= win.from && i <= win.to;
            const state = states[i] ?? (inWindow ? 'window' : undefined);
            return (
              <div className="array-slot" key={i}>
                <PointerChips pointers={above.filter((p) => p.index === i)} />
                <div className={`cell${stateClass(state)}`}>{v}</div>
                {(indexed || labels[i]) && <div className="slot-index">{labels[i] ?? i}</div>}
                <PointerChips pointers={below.filter((p) => p.index === i)} below />
              </div>
            );
          })}
        </div>
      )}
      {win?.label && <div className="viz-note">{win.label}</div>}
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}

export function BarsView({ viz }: { viz: BarsViz }) {
  const { values, states = [], pointers = [], overlays = [] } = viz;
  const max = Math.max(1, ...values, ...overlays.map((o) => o.to));
  const H = 150;
  const px = (units: number) => (units / max) * H;

  // A bar is 30px wide with a 4px gutter, so an overlay spanning n bars is
  // 34n - 4 pixels wide, anchored on the left edge of its starting bar.
  const BAR_W = 30;
  const GAP = 4;

  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      <div className="bars-viz">
        {values.map((v, i) => (
          <div className="bar-slot" key={i}>
            <PointerChips pointers={pointers.filter((p) => p.index === i)} />
            {overlays
              .filter((o) => o.index === i)
              .map((o, k) => (
                <div
                  key={k}
                  className={`bar-overlay ${o.tone ?? 'water'}`}
                  style={{
                    left: 0,
                    bottom: px(o.from) + 22,
                    width: (o.span ?? 1) * BAR_W + ((o.span ?? 1) - 1) * GAP,
                    height: Math.max(2, px(o.to) - px(o.from)),
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    zIndex: 2,
                  }}
                >
                  {o.label}
                </div>
              ))}
            <div className={`bar${stateClass(states[i])}`} style={{ height: Math.max(2, px(v)) }}>
              <span className="bar-value">{v}</span>
            </div>
            <div className="slot-index">{i}</div>
          </div>
        ))}
      </div>
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}

export function GridView({ viz }: { viz: GridViz }) {
  const { values, states = [], badges = [], cursor, rowLabels, colLabels } = viz;
  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      <div className={`grid-viz${viz.compact ? ' compact' : ''}`}>
        {colLabels && (
          <div className="grid-axis">
            {rowLabels && <span style={{ minWidth: 18 }} />}
            {colLabels.map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        )}
        {values.map((row, r) => (
          <div className="grid-row" key={r}>
            {rowLabels && (
              <span className="slot-index" style={{ minWidth: 18, alignSelf: 'center' }}>
                {rowLabels[r]}
              </span>
            )}
            {row.map((v, c) => {
              const isCursor = cursor && cursor[0] === r && cursor[1] === c;
              return (
                <div key={c} className={`cell${stateClass(states[r]?.[c])}${isCursor ? ' cursor' : ''}`}>
                  {v}
                  {badges[r]?.[c] !== undefined && <span className="cell-badge">{badges[r][c]}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}

export function StackView({ viz }: { viz: StackViz }) {
  const variant = viz.variant ?? 'stack';
  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      {viz.items.length === 0 ? (
        <div className="viz-empty">{viz.emptyHint ?? 'empty'}</div>
      ) : (
        <div className={`stack-viz ${variant}`}>
          {viz.items.map((item, i) => (
            <div className="stack-row" key={`${i}-${item.value}`}>
              <div className={`stack-item${stateClass(item.state)}`}>{item.value}</div>
              {item.label && <span className="stack-tag">{item.label}</span>}
              {!item.label && variant === 'stack' && i === viz.items.length - 1 && (
                <span className="stack-tag">top</span>
              )}
              {!item.label && variant === 'queue' && i === 0 && <span className="stack-tag">front</span>}
            </div>
          ))}
        </div>
      )}
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}

export function MapView({ viz }: { viz: MapViz }) {
  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      {viz.entries.length === 0 ? (
        <div className="viz-empty">{viz.emptyHint ?? 'empty'}</div>
      ) : (
        <div className="map-viz">
          {viz.entries.map((e) => (
            <div className={`map-entry${stateClass(e.state)}`} key={String(e.key)}>
              <span className="map-key">{e.key}</span>
              {!viz.asSet && (
                <>
                  <span className="map-arrow">→</span>
                  <span className="map-value">{e.value}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}

export function TextView({ viz }: { viz: TextViz }) {
  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      {viz.lines.length === 0 ? (
        <div className="viz-empty">{viz.emptyHint ?? 'empty'}</div>
      ) : (
        <div className={`text-viz${viz.chips ? ' chips' : ''}`}>
          {viz.lines.map((l, i) => (
            <div className={`text-line${stateClass(l.state)}`} key={`${i}-${l.text}`}>
              {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function IntervalsView({ viz }: { viz: IntervalsViz }) {
  const starts = viz.intervals.map((i) => i.start);
  const ends = viz.intervals.map((i) => i.end);
  const min = viz.min ?? Math.min(0, ...starts);
  const max = viz.max ?? Math.max(1, ...ends);
  const span = Math.max(1, max - min);
  const pct = (v: number) => ((v - min) / span) * 100;

  const rows: typeof viz.intervals[] = [];
  for (const iv of viz.intervals) {
    const row = iv.row ?? rows.length;
    while (rows.length <= row) rows.push([]);
    rows[row].push(iv);
  }

  const ticks = Array.from({ length: Math.min(11, span + 1) }, (_, i) =>
    Math.round(min + (span * i) / Math.min(10, span)),
  );

  return (
    <div className="viz-block">
      {viz.title && <div className="viz-title">{viz.title}</div>}
      <div className="intervals-viz">
        {rows.map((row, r) => (
          <div className="interval-row" key={r}>
            {row.map((iv, i) => (
              <div
                key={i}
                className={`interval-bar${stateClass(iv.state)}`}
                style={{ left: `${pct(iv.start)}%`, width: `${Math.max(1.5, pct(iv.end) - pct(iv.start))}%` }}
                title={`[${iv.start}, ${iv.end}]`}
              >
                {iv.label ?? `${iv.start},${iv.end}`}
              </div>
            ))}
          </div>
        ))}
        <div className="interval-axis">
          {[...new Set(ticks)].map((t) => (
            <span key={t} className="interval-tick" style={{ left: `${pct(t)}%` }}>
              {t}
            </span>
          ))}
        </div>
      </div>
      {viz.note && <div className="viz-note">{viz.note}</div>}
    </div>
  );
}
