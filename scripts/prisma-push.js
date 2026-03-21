// This script is run via `node scripts/prisma-push.js`
// It executes `prisma db push` to sync the schema with the database

const { execSync } = require('child_process');

try {
  console.log('Pushing Prisma schema to database...');
  execSync('npx prisma db push --skip-generate', { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('Schema pushed successfully!');
} catch (error) {
  console.error('Failed to push schema:', error.message);
  process.exit(1);
}
