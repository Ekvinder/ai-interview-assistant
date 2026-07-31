import { ReactNode } from 'react';

/**
 * Meeting room layout — fullscreen, no sidebar or navbar.
 * The room component manages its own top/bottom bars.
 */
export default function MeetingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen w-full overflow-hidden flex flex-col bg-background">
      {children}
    </div>
  );
}
