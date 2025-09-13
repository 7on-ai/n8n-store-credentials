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

// Function to check if user record already exists
async function checkExistingUser() {
  try {
    console.log('[INFO] Checking if user record already exists...');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/launchmvpfast-saas-starterkit_user?id=eq.${USER_ID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check existing user: ${response.status}`);
    }

    const data = await response.json();
    return data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('[ERROR] Failed to check existing user:', error.message);
    throw error;
  }
}

// Function to create new user record
async function createUserRecord() {
  const payload = {
    id: USER_ID,
    email: N8N_USER_EMAIL, // ใช้ N8N_USER_EMAIL เป็น email
    n8n_url: N8N_URL,
    n8n_user_email: N8N_USER_EMAIL,
    n8n_encryption_key: N8N_ENCRYPTION_KEY,
    northflank_project_id: NORTHFLANK_PROJECT_ID,
    northflank_project_name: NORTHFLANK_PROJECT_NAME,
    northflank_project_status: 'ready',
    template_completed_at: new Date().toISOString()
  };

  console.log('[INFO] Creating new user record...');
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/launchmvpfast-saas-starterkit_user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create user record: ${response.status} - ${errorText}`);
  }

  console.log('[SUCCESS] User record created successfully!');
  return payload;
}

// Function to update existing user record
async function updateUserRecord() {
  const payload = {
    email: N8N_USER_EMAIL, // อัปเดต email ด้วย
    n8n_url: N8N_URL,
    n8n_user_email: N8N_USER_EMAIL,
    n8n_encryption_key: N8N_ENCRYPTION_KEY,
    northflank_project_id: NORTHFLANK_PROJECT_ID,
    northflank_project_name: NORTHFLANK_PROJECT_NAME,
    northflank_project_status: 'ready',
    template_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  console.log('[INFO] Updating existing user record...');
  
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update user record: ${response.status} - ${errorText}`);
  }

  console.log('[SUCCESS] User record updated successfully!');
  return payload;
}

// Function to verify N8N instance is accessible
async function verifyN8NInstance() {
  try {
    console.log('[INFO] Verifying N8N instance accessibility...');
    
    // Try multiple endpoints to verify N8N is running
    const endpoints = ['/healthz', '/healthz/readiness', '/'];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${N8N_URL}${endpoint}`, {
          method: 'GET',
          timeout: 10000
        });

        if (response.ok) {
          console.log(`[SUCCESS] N8N instance is accessible via ${endpoint}`);
          return true;
        }
      } catch (error) {
        console.log(`[DEBUG] Endpoint ${endpoint} failed: ${error.message}`);
        continue;
      }
    }
    
    console.log('[WARNING] N8N health checks failed, but continuing...');
    return true; // Continue anyway as N8N might be starting up
  } catch (error) {
    console.log(`[WARNING] N8N verification failed: ${error.message}, but continuing...`);
    return true; // Continue anyway
  }
}

// Function to wait for N8N to be fully ready
async function waitForN8NReady(maxRetries = 12, interval = 10000) {
  console.log('[INFO] Waiting for N8N to be fully ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${N8N_URL}/healthz/readiness`, {
        method: 'GET',
        timeout: 5000
      });

      if (response.ok) {
        console.log('[SUCCESS] N8N is ready!');
        return true;
      }
      
      console.log(`[INFO] Attempt ${i + 1}/${maxRetries}: N8N not ready yet, waiting ${interval/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, interval));
    } catch (error) {
      console.log(`[INFO] Attempt ${i + 1}/${maxRetries}: ${error.message}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  console.log('[WARNING] Max retries reached, proceeding anyway...');
  return false;
}

// Main execution
async function main() {
  try {
    console.log('[INFO] Starting main execution...');
    
    // Step 1: Wait for N8N to be ready
    await waitForN8NReady();
    
    // Step 2: Verify N8N instance
    await verifyN8NInstance();
    
    // Step 3: Check if user already exists
    const existingUser = await checkExistingUser();
    
    // Step 4: Create or update user record
    if (existingUser) {
      console.log('[INFO] User record exists, updating...');
      await updateUserRecord();
    } else {
      console.log('[INFO] Creating new user record...');
      await createUserRecord();
    }
    
    console.log('[SUCCESS] All operations completed successfully!');
    console.log(`[INFO] N8N instance available at: ${N8N_URL}`);
    console.log(`[INFO] Login with: ${N8N_USER_EMAIL}`);
    console.log(`[INFO] Project ID: ${NORTHFLANK_PROJECT_ID}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('[FATAL] Main execution failed:', error.message);
    console.error('[FATAL] Stack trace:', error.stack);
    
    // Try to update status as failed
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/launchmvpfast-saas-starterkit_user?id=eq.${USER_ID}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({
          northflank_project_status: 'failed',
          updated_at: new Date().toISOString()
        })
      });
    } catch (updateError) {
      console.error('[ERROR] Failed to update error status:', updateError.message);
    }
    
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
