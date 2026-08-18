import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/get-session';
import { getDb } from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { ProfileClient } from './profile-client';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const db = getDb();
  const user = db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, parseInt(session.sub, 10)))
    .get();

  return <ProfileClient name={session.name} email={user?.email ?? ''} />;
}
