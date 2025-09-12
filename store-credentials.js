#!/usr/bin/env node

/**
 * Store N8N Credentials Script
 * This script sends N8N instance credentials to Supabase including API key
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

// Function to retrieve existing N8N API key from database
async function getExistingAPIKey() {
  try {
    console.log('[INFO] Checking for existing N8N API key...');
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/launchmvpfast-saas-starterkit_user?id=eq.${USER_ID}&select=n8n_api_key,n8n_api_key_label,n8n_api_key_created_at`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check existing API key: ${response.status}`);
    }

    const data = await response.json();
    if (data.length > 0 && data[0].n8n_api_key) {
      console.log('[INFO] Found existing N8N API key in database');
      console.log(`[INFO] API Key Label: ${data[0].n8n_api_key_label || 'N/A'}`);
      console.log(`[INFO] Created At: ${data[0].n8n_api_key_created_at || 'N/A'}`);
      console.log(`[INFO] API Key Preview: ${data[0].n8n_api_key.substring(0, 15)}...`);
      return {
        apiKey: data[0].n8n_api_key,
        label: data[0].n8n_api_key_label,
        createdAt: data[0].n8n_api_key_created_at
      };
    }
    
    console.log('[INFO] No existing API key found');
    return null;
  } catch (error) {
    console.error('[ERROR] Failed to check existing API key:', error.message);
    throw error;
  }
}

// Function to validate N8N API key functionality
async function validateAPIKey(apiKey) {
  if (!apiKey) {
    console.log('[WARNING] No API key to validate');
    return false;
  }

  try {
    console.log('[INFO] Validating N8N API key functionality...');
    
    const response = await fetch(`${N8N_URL}/rest/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Accept': 'application/json'
      },
      timeout: 15000
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[SUCCESS] API key is functional - Found ${data.length || 0} workflows`);
      return true;
    } else if (response.status === 401) {
      console.log('[ERROR] API key is invalid or expired');
      return false;
    } else if (response.status === 403) {
      console.log('[SUCCESS] API key is functional but has limited permissions');
      return true;
    } else {
      console.log(`[WARNING] API key validation returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`[WARNING] API key validation failed: ${error.message}`);
    return false;
  }
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
async function createUserRecord(existingAPIKey = null) {
  const payload = {
    id: USER_ID,
    email: N8N_USER_EMAIL,
    n8n_url: N8N_URL,
    n8n_user_email: N8N_USER_EMAIL,
    n8n_user_password: N8N_USER_PASSWORD,
    n8n_encryption_key: N8N_ENCRYPTION_KEY,
    northflank_project_id: NORTHFLANK_PROJECT_ID,
    northflank_project_name: NORTHFLANK_PROJECT_NAME,
    northflank_project_status: 'ready',
    template_completed_at: new Date().toISOString()
  };

  // Include API key information if available
  if (existingAPIKey) {
    payload.n8n_api_key = existingAPIKey.apiKey;
    payload.n8n_api_key_label = existingAPIKey.label;
    payload.n8n_api_key_created_at = existingAPIKey.createdAt;
  }

  console.log('[INFO] Creating new user record...');
  console.log(`[INFO] Including API key: ${existingAPIKey ? 'Yes' : 'No'}`);
  
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
async function updateUserRecord(existingAPIKey = null) {
  const payload = {
    email: N8N_USER_EMAIL,
    n8n_url: N8N_URL,
    n8n_user_email: N8N_USER_EMAIL,
    n8n_user_password: N8N_USER_PASSWORD,
    n8n_encryption_key: N8N_ENCRYPTION_KEY,
    northflank_project_id: NORTHFLANK_PROJECT_ID,
    northflank_project_name: NORTHFLANK_PROJECT_NAME,
    northflank_project_status: 'ready',
    template_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Include API key information if available and not already stored
  if (existingAPIKey) {
    payload.n8n_api_key = existingAPIKey.apiKey;
    payload.n8n_api_key_label = existingAPIKey.label;
    payload.n8n_api_key_created_at = existingAPIKey.createdAt;
  }

  console.log('[INFO] Updating existing user record...');
  console.log(`[INFO] Including API key: ${existingAPIKey ? 'Yes' : 'No'}`);
  
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

// Function to test N8N login credentials
async function testN8NLogin() {
  try {
    console.log('[INFO] Testing N8N login credentials...');
    
    const response = await fetch(`${N8N_URL}/rest/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        emailOrLdapLoginId: N8N_USER_EMAIL,
        password: N8N_USER_PASSWORD
      }),
      timeout: 30000
    });

    if (response.ok) {
      console.log('[SUCCESS] N8N login credentials are valid');
      return true;
    } else {
      console.log(`[WARNING] Login test returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`[WARNING] Login test failed: ${error.message}`);
    return false;
  }
}

// Main execution
async function main() {
  try {
    console.log('[INFO] Starting main execution...');
    
    // Step 1: Wait for N8N to be ready
    await waitForN8NReady();
    
    // Step 2: Verify N8N instance
    await verifyN8NInstance();
    
    // Step 3: Test login credentials
    await testN8NLogin();
    
    // Step 4: Check for existing API key
    const existingAPIKey = await getExistingAPIKey();
    
    // Step 5: Validate API key if it exists
    let validAPIKey = null;
    if (existingAPIKey) {
      const isValid = await validateAPIKey(existingAPIKey.apiKey);
      if (isValid) {
        validAPIKey = existingAPIKey;
        console.log('[SUCCESS] Existing API key is functional');
      } else {
        console.log('[WARNING] Existing API key is not functional');
      }
    }
    
    // Step 6: Check if user already exists
    const existingUser = await checkExistingUser();
    
    // Step 7: Create or update user record
    if (existingUser) {
      console.log('[INFO] User record exists, updating...');
      await updateUserRecord(validAPIKey);
    } else {
      console.log('[INFO] Creating new user record...');
      await createUserRecord(validAPIKey);
    }
    
    console.log('[SUCCESS] All operations completed successfully!');
    console.log(`[INFO] N8N instance available at: ${N8N_URL}`);
    console.log(`[INFO] Login with: ${N8N_USER_EMAIL}`);
    console.log(`[INFO] Project ID: ${NORTHFLANK_PROJECT_ID}`);
    console.log(`[INFO] Project Name: ${NORTHFLANK_PROJECT_NAME}`);
    
    if (validAPIKey) {
      console.log(`[INFO] API Key Label: ${validAPIKey.label || 'N/A'}`);
      console.log(`[INFO] API Key Preview: ${validAPIKey.apiKey.substring(0, 15)}...`);
      console.log(`[INFO] API Key Status: Functional`);
    } else {
      console.log(`[WARNING] No functional API key found - may need to be created separately`);
    }
    
    console.log('[SUCCESS] ✅ N8N credentials successfully stored in Supabase!');
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
          n8n_setup_error: error.message,
          updated_at: new Date().toISOString()
        })
      });
      console.log('[INFO] Updated error status in database');
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
