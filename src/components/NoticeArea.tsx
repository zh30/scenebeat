import type { ReactNode } from 'react';

export interface NoticeAreaProps {
  /**
   * Notices to show: the Update_Prompt, the Offline_Ready_Notice, and the
   * storage notices. Each child can use the existing `.sb-notice` classes.
   */
  children?: ReactNode;
}

/**
 * Polite live region fixed at the bottom of the viewport (Requirements 7.1,
 * 8.1, 13.7, 13.8). It always renders, even when empty, so screen readers
 * announce notices that are added later. It is not modal and traps no focus.
 */
export function NoticeArea({ children }: NoticeAreaProps) {
  return (
    <div className="sb-notice-area" role="status" aria-live="polite">
      {children}
    </div>
  );
}

export default NoticeArea;
