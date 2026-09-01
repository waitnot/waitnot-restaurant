import { migrateDeliveryOrdersFeature } from './migrate-delivery-orders-feature.js';

console.log('🚀 Starting delivery orders feature migration...');

migrateDeliveryOrdersFeature()
  .then(() => {
    console.log('✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });