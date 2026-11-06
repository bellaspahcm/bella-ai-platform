'use client';

import React from 'react';

/**
 * Bella Interior OS — Layout wrapper.
 *
 * The global Sidebar (sidebar.tsx) renders this vertical's menu automatically
 * when pathname starts with /dashboard/interior (isBellaInteriorShell = true).
 * DashboardAuthorizedShell in DashboardLoadingShell.tsx owns the flex container
 * and the <Sidebar /> mount — this layout must NOT add its own sidebar or header.
 */
export default function InteriorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col min-w-0 max-w-full overflow-hidden">
      {children}
    </div>
  );
}
