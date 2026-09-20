import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasInventoryAccess } from '@/lib/inventory/access';
import { hasDwhAccess } from '@/lib/dwh/access';
import { hasGeoAccess } from '@/lib/geo/access';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { getPricingAccessLevel } from '@/lib/pricing/access';
import { Sidebar }    from '@/components/sidebar';
import { PostHogProvider } from '@/components/posthog-provider';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const canSeeInventory = await hasInventoryAccess(db, session.sub, session.role);
  const canSeeAnalitica  = await hasDwhAccess(db, session.sub, session.role);
  const canSeeMapa = await hasGeoAccess(db, session.sub, session.role);
  const canSeeRecipes = await hasRecipesAccess(db, session.sub, session.role);
  const pricingAccessLevel = await getPricingAccessLevel(db, session.sub, session.role);

  return (
    <PostHogProvider user={session}>
      {/*
        print:h-auto print:overflow-visible on both this wrapper and <main>
        below: on screen this is a fixed-height flex shell (sidebar + a
        scrolling main content pane), but a `height: 100vh` / `overflow:
        hidden` ancestor clips anything printed beyond one page regardless of
        what child elements do — a seller's printed 360° profile (7 stacked
        sections) needs every ancestor between here and the content relaxed
        to its natural height for browser print-to-PDF to produce more than
        one page. See docs/superpowers/specs/
        2026-09-27-seller-360-dashboard-design.md Section 9.
      */}
      <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
        <Sidebar user={session} canSeeInventory={canSeeInventory} canSeeAnalitica={canSeeAnalitica} canSeeMapa={canSeeMapa} canSeeRecipes={canSeeRecipes} pricingAccessLevel={pricingAccessLevel} />
        <main className="flex-1 overflow-auto bg-gray-50 print:overflow-visible print:h-auto">
          {children}
        </main>
      </div>
    </PostHogProvider>
  );
}
