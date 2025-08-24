#!/usr/bin/env node

/**
 * Store N8N Credentials Script
 * This script sends N8N instance credentials to Supabase
 */

console.log('[INFO] Starting N8N credentials storage process...');

// Get environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID = process.env.USER_ID;
const N8N_URL = process.env.N8N_URL;
const N8N_USER_EMAIL = process.env.N8N_USER_EMAIL;
const N8N_USER_PASSWORD = process.env.N8N_USER_PASSWORD;
const N8N_ENCRYPTION_KEY = process.env.N8N_ENCRYPTION_KEY;
const NORTHFLANK_PROJECT_ID = process.env.NORTHFLANK_PROJECT_ID;
const NORTHFLANK_PROJECT_NAME = process.env.NORTHFLANK_PROJECT_NAME;

console.log('[INFO] Environment variables loaded:');
console.log(`- SUPABASE_URL: ${SUPABASE_URL ? 'Set' : 'Missing'}`);
console.log(`- USER_ID: ${USER_ID ? 'Set' : 'Missing'}`);
console.log(`- N8N_URL: ${N8N_URL ? 'Set' : 'Missing'}`);
console.log(`- N8N_USER_EMAIL: ${N8N_USER_EMAIL ? 'Set' : 'Missing'}`);
console.log(`- NORTHFLANK_PROJECT_ID: ${NORTHFLANK_PROJECT_ID ? 'Set' : 'Missing'}`);

// Validate required environment variables
const requiredVars = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  USER_ID,
  N8N_URL,
  N8N_USER_EMAIL,
  N8N_USER_PASSWORD,
  N8N_ENCRYPTION_KEY,
  NORTHFLANK_PROJECT_ID
};

const missingVars = Object.entries(requiredVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('[ERROR] Missing required environment variables:', missingVars);
  process.exit(1);
}

// Prepare payload for Supabase
const payload = {
  n8n_url: N8N_URL,
  n8n_user_email: N8N_USER_EMAIL,
  n8n_encryption_key: N8N_ENCRYPTION_KEY,
  northflank_project_id: NORTHFLANK_PROJECT_ID,
  northflank_project_name: NORTHFLANK_PROJECT_NAME,
  northflank_project_status: 'ready',
  template_completed_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

console.log('[INFO] Payload prepared:', JSON.stringify(payload, null, 2));

// Function to update Supabase
async function updateSupabase() {
  try {
    console.log('[INFO] Sending data to Supabase...');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/launchmvpfast-saas-starterkit_user?id=eq.${USER_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(payload)
    });

    console.log(`[INFO] Supabase response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ERROR] Supabase update failed:', errorText);
      throw new Error(`Supabase update failed: ${response.status} - ${errorText}`);
    }

    console.log('[SUCCESS] N8N credentials successfully stored in Supabase!');
    return true;
  } catch (error) {
    console.error('[ERROR] Failed to update Supabase:', error.message);
    throw error;
  }
}

// Function to verify N8N instance is accessible
async function verifyN8NInstance() {
  try {
    console.log('[INFO] Verifying N8N instance accessibility...');
    
    const response = await fetch(`${N8N_URL}/healthz`, {
      method: 'GET',
      timeout: 10000
    });

    if (response.ok) {
      console.log('[SUCCESS] N8N instance is accessible');
      return true;
    } else {
      console.log(`[WARNING] N8N health check returned ${response.status}, but continuing...`);
      return true; // Continue anyway as some N8N instances might not have health endpoint
    }
  } catch (error) {
    console.log(`[WARNING] N8N health check failed: ${error.message}, but continuing...`);
    return true; // Continue anyway
  }
}

// Main execution
async function main() {
  try {
    console.log('[INFO] Starting main execution...');
    
    // Step 1: Verify N8N instance
    await verifyN8NInstance();
    
    // Step 2: Wait a moment to ensure everything is stable
    console.log('[INFO] Waiting 5 seconds to ensure stability...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Update Supabase
    await updateSupabase();
    
    console.log('[SUCCESS] All operations completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('[FATAL] Main execution failed:', error.message);
    console.error('[FATAL] Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error.message);
  console.error('[FATAL] Stack trace:', error.stack);
  process.exit(1);
});

// Start the process
console.log('[INFO] Initializing...');
main();
