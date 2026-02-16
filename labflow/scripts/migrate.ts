/**
 * Migration runner wrapper
 *
 * Runs Prisma migrations against the configured database.
 * Supports both development (migrate dev) and production (migrate deploy) modes.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts              # Development mode (migrate dev)
 *   npx tsx scripts/migrate.ts --deploy     # Production mode (migrate deploy)
 *   npx tsx scripts/migrate.ts --reset      # Reset and re-apply all migrations
 *   npx tsx scripts/migrate.ts --status     # Show migration status
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const dbDir = resolve(rootDir, 'packages', 'db');

function run(command: string) {
  execSync(command, {
    cwd: dbDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'development',
    },
  });
}

function main() {
  const args = process.argv.slice(2);
  const flag = args[0] || '';

  try {
    if (flag === '--deploy') {
      console.log('Running Prisma migrations (deploy mode)...\n');
      run('npx prisma migrate deploy');
    } else if (flag === '--reset') {
      console.log('Resetting database and re-applying all migrations...\n');
      run('npx prisma migrate reset --force');
    } else if (flag === '--status') {
      console.log('Checking migration status...\n');
      run('npx prisma migrate status');
    } else if (flag === '--generate') {
      console.log('Generating Prisma client...\n');
      run('npx prisma generate');
    } else {
      console.log('Running Prisma migrations (development mode)...\n');

      // Generate the client first
      run('npx prisma generate');

      // Run migrate dev
      const migrationName = args.find((a) => !a.startsWith('--')) || 'migration';
      run(`npx prisma migrate dev --name ${migrationName}`);
    }

    console.log('\nMigration complete.');
  } catch (error) {
    console.error('\nMigration failed. Check the error output above.');
    process.exit(1);
  }
}

main();
