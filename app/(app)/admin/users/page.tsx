import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { getDb }    from '@/lib/db/sqlite';
import { users, userModules } from '@/lib/db/schema';
import { UsersClient } from './users-client';

export default async function UsersPage() {
  const session = await getSession();
  if (!session)               redirect('/login');
  if (session.role !== 'admin') redirect('/reports/ventas');

  const db = getDb();
  const userList = db.select({
    id:        users.id,
    email:     users.email,
    name:      users.name,
    role:      users.role,
    createdAt: users.createdAt,
  }).from(users).all();

  const allModuleGrants = db.select().from(userModules).all();
  const modulesByUser = new Map<number, string[]>();
  for (const grant of allModuleGrants) {
    const existing = modulesByUser.get(grant.userId) ?? [];
    existing.push(grant.module);
    modulesByUser.set(grant.userId, existing);
  }

  const withModules = userList.map(u => ({
    ...u,
    modules: modulesByUser.get(u.id) ?? [],
  }));

  return (
    <UsersClient
      initialUsers={withModules}
      currentUserId={parseInt(session.sub)}
    />
  );
}
