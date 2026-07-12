import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/get-session';
import { db }    from '@/lib/db/sqlite';
import { users } from '@/lib/db/schema';
import { UsersClient } from './users-client';

export default async function UsersPage() {
  const session = await getSession();
  if (!session)               redirect('/login');
  if (session.role !== 'admin') redirect('/reports/ventas');

  const userList = db.select({
    id:        users.id,
    email:     users.email,
    name:      users.name,
    role:      users.role,
    createdAt: users.createdAt,
  }).from(users).all();

  return (
    <UsersClient
      initialUsers={userList as Parameters<typeof UsersClient>[0]['initialUsers']}
      currentUserId={parseInt(session.sub)}
    />
  );
}
