/** Minimal inline icon set — 16px stroke icons, no dependency. */
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconPlay = () => (
  <svg {...base} fill="currentColor" stroke="none" width={18} height={18}>
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
);

export const IconPause = () => (
  <svg {...base} fill="currentColor" stroke="none" width={18} height={18}>
    <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
  </svg>
);

export const IconNext = () => (
  <svg {...base}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconPrev = () => (
  <svg {...base}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const IconStart = () => (
  <svg {...base}>
    <path d="M18 6l-6 6 6 6M7 5v14" />
  </svg>
);

export const IconEnd = () => (
  <svg {...base}>
    <path d="M6 6l6 6-6 6M17 5v14" />
  </svg>
);

export const IconSearch = () => (
  <svg {...base} width={14} height={14}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const IconSun = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconMoon = () => (
  <svg {...base}>
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </svg>
);

export const IconExternal = () => (
  <svg {...base} width={13} height={13}>
    <path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </svg>
);

export const IconMenu = () => (
  <svg {...base}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconRepeat = () => (
  <svg {...base} width={15} height={15}>
    <path d="M3 12a9 9 0 0115.5-6.2M21 12a9 9 0 01-15.5 6.2" />
    <path d="M18 3v4h-4M6 21v-4h4" />
  </svg>
);

export const IconMaximize = () => (
  <svg {...base} width={15} height={15}>
    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
  </svg>
);

export const IconMinimize = () => (
  <svg {...base} width={15} height={15}>
    <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
  </svg>
);
