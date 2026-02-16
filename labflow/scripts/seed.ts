/**
 * Seed script wrapper
 *
 * Runs the Prisma seed file located at packages/db/prisma/seed.ts.
 * Usage: npx tsx scripts/seed.ts
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');
const dbDir = resolve(rootDir, 'packages', 'db');

function main() {
  console.log('Running LabFlow database seed...\n');

  try {
    execSync('npx tsx prisma/seed.ts', {
      cwd: dbDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    });
  } catch (error) {
    console.error('\nSeed failed. Check the error output above.');
    process.exit(1);
  }
}

main();
