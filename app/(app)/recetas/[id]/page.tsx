import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { hasRecipesAccess } from '@/lib/recipes/access';
import { HelpPanel } from '@/components/help-panel';
import { RecipeDetailClient } from './recipe-detail-client';

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const allowed = await hasRecipesAccess(db, session.sub, session.role);
  if (!allowed) redirect('/reports/ventas');

  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) notFound();

  return (
    <>
      <RecipeDetailClient recipeId={recipeId} />
      <HelpPanel page="recetas" />
    </>
  );
}
