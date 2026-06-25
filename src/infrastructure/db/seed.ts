import { runDatabaseSeeder } from './seeder';

async function main() {
  await runDatabaseSeeder();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
