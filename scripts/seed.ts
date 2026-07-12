import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import prompts from 'prompts';
import { db } from '../lib/db/sqlite';
import { users } from '../lib/db/schema';

// Ensure schema is up-to-date before inserting
migrate(db, { migrationsFolder: './drizzle/migrations' });

async function main() {
  console.log('\n─── Crear usuario administrador ───────────────────────\n');

  const answers = await prompts([
    {
      type:     'text',
      name:     'email',
      message:  'Email:',
      validate: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || 'Email inválido',
    },
    {
      type:    'text',
      name:    'name',
      message: 'Nombre completo:',
      validate: (v: string) => v.trim().length >= 2 || 'Nombre demasiado corto',
    },
    {
      type:     'password',
      name:     'password',
      message:  'Contraseña:',
      validate: (v: string) => v.length >= 8 || 'Mínimo 8 caracteres',
    },
  ], {
    onCancel: () => {
      console.log('\nCancelado.');
      process.exit(0);
    },
  });

  let confirmPassword = '';
  while (confirmPassword !== answers.password) {
    const confirm = await prompts([
      {
        type:     'password',
        name:     'confirm',
        message:  'Confirmar contraseña:',
      },
    ], {
      onCancel: () => {
        console.log('\nCancelado.');
        process.exit(0);
      },
    });
    confirmPassword = confirm.confirm;
    if (confirmPassword !== answers.password) {
      console.log('Las contraseñas no coinciden');
    }
  }

  const email = (answers.email as string).trim().toLowerCase();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) {
    console.error(`\n✗ Ya existe un usuario con el email: ${email}`);
    process.exit(1);
  }

  const passwordHash = await argon2.hash(answers.password as string);

  db.insert(users).values({
    email,
    name:      (answers.name as string).trim(),
    passwordHash,
    role:      'admin',
    createdAt: Date.now(),
  }).run();

  console.log(`\n✓ Usuario administrador creado: ${email}\n`);
}

main().catch((err) => {
  console.error('\n✗ Error:', err.message);
  process.exit(1);
});
