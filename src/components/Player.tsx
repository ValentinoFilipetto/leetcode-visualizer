import { IconEnd, IconNext, IconPause, IconPlay, IconPrev, IconRepeat, IconStart } from './icons';

export interface PlayerProps {
  index: number;
  total: number;
  playing: boolean;
  speed: number;
  onSeek: (index: number) => void;
  onTogglePlay: () => void;
  onSpeed: (speed: number) => void;
  onRestart: () => void;
}

const SPEEDS = [
  { label: '0.5×', value: 1600 },
  { label: '1×', value: 800 },
  { label: '2×', value: 400 },
  { label: '4×', value: 180 },
  { label: '8×', value: 80 },
];

export function Player({ index, total, playing, speed, onSeek, onTogglePlay, onSpeed, onRestart }: PlayerProps) {
  const last = Math.max(0, total - 1);
  const pct = last === 0 ? 0 : (index / last) * 100;

  return (
    <div className="player">
      <button className="step-btn" onClick={() => onSeek(0)} disabled={index === 0} title="First step (Home)">
        <IconStart />
      </button>
      <button
        className="step-btn"
        onClick={() => onSeek(index - 1)}
        disabled={index === 0}
        title="Previous step (←)"
      >
        <IconPrev />
      </button>
      <button className="play-btn" onClick={onTogglePlay} title="Play / pause (Space)">
        {playing ? <IconPause /> : <IconPlay />}
      </button>
      <button
        className="step-btn"
        onClick={() => onSeek(index + 1)}
        disabled={index >= last}
        title="Next step (→)"
      >
        <IconNext />
      </button>
      <button className="step-btn" onClick={() => onSeek(last)} disabled={index >= last} title="Last step (End)">
        <IconEnd />
      </button>
      <button className="step-btn" onClick={onRestart} title="Restart (R)">
        <IconRepeat />
      </button>

      <div className="scrub">
        <div className="scrub-track">
          <div className="scrub-fill" style={{ width: `calc(${pct}% - ${(pct / 100) * 16}px + 8px)` }} />
          <input
            type="range"
            min={0}
            max={last}
            value={index}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Algorithm step"
          />
        </div>
        <div className="scrub-meta">
          <span>
            step {index + 1} / {total}
          </span>
          <span className="shortcuts">
            <kbd>←</kbd>
            <kbd>→</kbd>
            <kbd>space</kbd>
          </span>
        </div>
      </div>

      <select
        className="speed-select"
        value={speed}
        onChange={(e) => onSpeed(Number(e.target.value))}
        aria-label="Playback speed"
      >
        {SPEEDS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
