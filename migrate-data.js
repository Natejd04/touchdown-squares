// Migration Script - Import your existing localStorage data to Firebase
// Run this in the browser console after uploading your exported JSON file

import { importExistingData } from './database-service.js';

export async function runMigration() {
  console.log('🚀 Starting data migration...');
  
  // Create file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  
  return new Promise((resolve, reject) => {
    fileInput.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        if (!file) {
          reject('No file selected');
          return;
        }
        
        console.log('📄 Reading file...');
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Validate data structure
        if (!data.users || !data.pools || !data.activityLog) {
          throw new Error('Invalid data format. Expected: { users, pools, activityLog }');
        }
        
        console.log(`📊 Found ${data.users.length} users, ${data.pools.length} pools, ${data.activityLog.length} activity logs`);
        console.log('⏳ Importing to Firebase...');
        
        // Import to Firebase
        await importExistingData(data.users, data.pools, data.activityLog);
        
        console.log('✅ Migration complete!');
        console.log('📌 Next steps:');
        console.log('   1. Refresh the page');
        console.log('   2. Try logging in');
        console.log('   3. Verify your data is there');
        
        document.body.removeChild(fileInput);
        resolve();
        
      } catch (error) {
        console.error('❌ Migration failed:', error);
        document.body.removeChild(fileInput);
        reject(error);
      }
    };
    
    fileInput.click();
  });
}

// Auto-run if this script is imported
if (typeof window !== 'undefined') {
  window.runMigration = runMigration;
  console.log('💡 Migration helper loaded! Run: runMigration()');
}
