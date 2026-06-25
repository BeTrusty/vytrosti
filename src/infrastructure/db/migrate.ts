import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './client';
import path from 'path';

export async function runMigrations() {
  console.log('Running database migrations...');
  try {
    await migrate(db, {
      migrationsFolder: path.join(process.cwd(), 'src/infrastructure/db/migrations'),
    });
    console.log('Database migrations completed successfully!');
  } catch (error) {
    console.error('Database migration failed:', error);
    throw error;
  }
}

// Support running directly from command line if executed via tsx
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
