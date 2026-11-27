import React from 'react';
import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import SiteDiaryPwaView from '@/components/interior/SiteDiaryPwaView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Giám Sát Công Trình PWA | Bella Interior',
  description: 'App di động PWA dành cho Kỹ sư Giám sát công trình, ghi nhật ký, tải ảnh hiện trạng lên Cloudflare R2.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Giám Sát PWA',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#10b981',
};

export default async function StandaloneSitePwaPage() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      redirect('/login?next=/site-pwa');
    }
  } catch (err) {
    // Re-throw Next.js redirect errors, otherwise redirect safely
    if (err && typeof err === 'object' && 'digest' in err) {
      throw err;
    }
    redirect('/login?next=/site-pwa');
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <SiteDiaryPwaView standaloneMode={true} />
    </main>
  );
}
