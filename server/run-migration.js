import { migrateFeatures } from './migrate-features.js';

console.log('🚀 Starting features migration...');

migrateFeatures()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });