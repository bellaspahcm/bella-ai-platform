'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/interior', icon: '🏠' },
  { label: 'Design Studio', href: '/dashboard/interior/design', icon: '🎨' },
  { label: 'BOQ & Costing', href: '/dashboard/interior/boq', icon: '📋' },
  { label: 'Contracts', href: '/dashboard/interior/contracts', icon: '📄' },
  { label: 'Production', href: '/dashboard/interior/production', icon: '🏭' },
  { label: 'Installation', href: '/dashboard/interior/installation', icon: '🔧' },
  { label: 'QC & Handover', href: '/dashboard/interior/qc-handover', icon: '✅' },
  { label: 'Finance', href: '/dashboard/interior/finance', icon: '💰' },
  { label: 'Warranty', href: '/dashboard/interior/warranty', icon: '🛡️' },
];

interface InteriorLayoutProps {
  children: React.ReactNode;
}

export default function InteriorLayout({ children }: InteriorLayoutProps) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/dashboard/interior') {
      return pathname === '/dashboard/interior';
    }
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        {/* Header strip */}
        <div className="h-16 flex items-center px-5 border-b border-gray-200 bg-gradient-to-r from-indigo-700 to-purple-700">
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-wide">Bella Interior OS</p>
            <p className="text-indigo-200 text-xs">Project Management Suite</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 border-l-2 border-indigo-600 pl-2.5'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">Bella SPA ERP v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
