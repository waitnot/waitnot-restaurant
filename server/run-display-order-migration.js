import { addDisplayOrderColumn } from './add-display-order-column.js';

console.log('🚀 Starting display_order column migration...');

addDisplayOrderColumn()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });