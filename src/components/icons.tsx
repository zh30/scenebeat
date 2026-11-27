/** Small inline icons (no network, no icon library). */
const base = { width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false } as const;

export const PlayIcon = () => (
  <svg {...base} fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
);
export const PauseIcon = () => (
  <svg {...base} fill="currentColor"><rect x="6" y="5" width="4.5" height="14" rx="1.2" /><rect x="13.5" y="5" width="4.5" height="14" rx="1.2" /></svg>
);
export const PrevIcon = () => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
);
export const NextIcon = () => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
);
export const DownloadIcon = () => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 19h14" /></svg>
);
