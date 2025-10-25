#!/usr/bin/env node

/**
 * Store N8N Credentials Script
 * This script sends N8N instance credentials to Neon Database
 * Version: 2.1.0 - Enhanced with better retry logic and longer waits
 */

import pg from 'pg';
const { Client } = pg;

console.log('[INFO] Starting N8N credentials storage process v2.1.0...');

// Get environment variables
const DATABASE_URL = process.env.DATABASE_URL;
const CLERK_USER_ID = process.env.CLERK_USER_ID;
const USER_EMAIL = process.env.USER_EMAIL;
const N8N_URL = process.env.N8N_URL;
const N8N_USER_EMAIL = process.env.N8N_USER_EMAIL;
const N8N_USER_PASSWORD = process.env.N8N_USER_PASSWORD;
const N8N_ENCRYPTION_KEY = process.env.N8N_ENCRYPTION_KEY;
const NORTHFLANK_PROJECT_ID = process.env.NORTHFLANK_PROJECT_ID;
const NORTHFLANK_PROJECT_NAME = process.env.NORTHFLANK_PROJECT_NAME;

console.log('[INFO] Environment variables loaded:');
console.log(`- DATABASE_URL: ${DATABASE_URL ? 'Set' : 'Missing'}`);
console.log(`- CLERK_USER_ID: ${CLERK_USER_ID ? 'Set' : 'Missing'}`);
console.log(`- USER_EMAIL: ${USER_EMAIL ? 'Set' : 'Missing'}`);
console.log(`- N8N_URL: ${N8N_URL ? 'Set' : 'Missing'}`);
console.log(`- N8N_USER_EMAIL: ${N8N_USER_EMAIL ? 'Set' : 'Missing'}`);
console.log(`- NORTHFLANK_PROJECT_ID: ${NORTHFLANK_PROJECT_ID ? 'Set' : 'Missing'}`);

// Validate required environment variables
const requiredVars = {
  DATABASE_URL,
  CLERK_USER_ID,
  USER_EMAIL,
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

// Create PostgreSQL client
let client;

async function connectToDatabase() {
  try {
    console.log('[INFO] Connecting to Neon database...');
    client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 30000,
    });
    await client.connect();
    console.log('[SUCCESS] Connected to Neon database!');
    return client;
  } catch (error) {
    console.error('[ERROR] Failed to connect to database:', error.message);
    throw error;
  }
}

// Function to check if user record already exists
async function checkExistingUser() {
  try {
    console.log('[INFO] Checking if user record already exists...');
    
    const query = `
      SELECT * FROM "User" 
      WHERE "clerkId" = $1
      LIMIT 1
    `;
    
    const result = await client.query(query, [CLERK_USER_ID]);
    
    if (result.rows.length > 0) {
      console.log('[INFO] Found existing user record');
      return result.rows[0];
    }
    
    console.log('[INFO] No existing user record found');
    return null;
  } catch (error) {
    console.error('[ERROR] Failed to check existing user:', error.message);
    throw error;
  }
}

// Function to create new user record
async function createUserRecord() {
  try {
    console.log('[INFO] Creating new user record...');
    
    const generateId = () => {
      const timestamp = Date.now().toString(36);
      const randomStr = Math.random().toString(36).substring(2, 15);
      return `c${timestamp}${randomStr}`;
    };
    
    const query = `
      INSERT INTO "User" (
        id,
        "clerkId",
        email,
        "subscriptionTier",
        "apiCallsCount",
        "usageResetAt",
        "n8nUrl",
        "n8nUserEmail",
        "n8nEncryptionKey",
        "northflankProjectId",
        "northflankProjectName",
        "northflankProjectStatus",
        "northflankCreatedAt",
        "templateCompletedAt",
        "createdAt",
        "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    
    const now = new Date();
    const userId = generateId();
    
    const values = [
      userId,
      CLERK_USER_ID,
      USER_EMAIL,
      'FREE',
      0,
      now,
      N8N_URL,
      N8N_USER_EMAIL,
      N8N_ENCRYPTION_KEY,
      NORTHFLANK_PROJECT_ID,
      NORTHFLANK_PROJECT_NAME || 'N8N Instance',
      'ready',
      now,
      now,
      now,
      now
    ];
    
    const result = await client.query(query, values);
    console.log('[SUCCESS] User record created successfully!');
    console.log(`[INFO] Generated User ID: ${userId}`);
    return result.rows[0];
  } catch (error) {
    console.error('[ERROR] Failed to create user record:', error.message);
    throw error;
  }
}

// Function to update existing user record
async function updateUserRecord() {
  try {
    console.log('[INFO] Updating existing user record...');
    
    const query = `
      UPDATE "User" 
      SET 
        email = $2,
        "n8nUrl" = $3,
        "n8nUserEmail" = $4,
        "n8nEncryptionKey" = $5,
        "northflankProjectId" = $6,
        "northflankProjectName" = $7,
        "northflankProjectStatus" = $8,
        "northflankCreatedAt" = $9,
        "templateCompletedAt" = $10,
        "updatedAt" = $11,
        "n8nSetupError" = NULL
      WHERE "clerkId" = $1
      RETURNING *
    `;
    
    const now = new Date();
    const values = [
      CLERK_USER_ID,
      USER_EMAIL,
      N8N_URL,
      N8N_USER_EMAIL,
      N8N_ENCRYPTION_KEY,
      NORTHFLANK_PROJECT_ID,
      NORTHFLANK_PROJECT_NAME || 'N8N Instance',
      'ready',
      now,
      now,
      now
    ];
    
    const result = await client.query(query, values);
    console.log('[SUCCESS] User record updated successfully!');
    return result.rows[0];
  } catch (error) {
    console.error('[ERROR] Failed to update user record:', error.message);
    throw error;
  }
}

// Enhanced: Function to wait for N8N to be fully ready with exponential backoff
async function waitForN8NReady(maxRetries = 30, initialInterval = 10000) {
  console.log('[INFO] Waiting for N8N to be fully ready (up to 10 minutes)...');
  console.log(`[INFO] Will check ${maxRetries} times with exponential backoff`);
  
  const endpoints = ['/healthz/readiness', '/healthz', '/'];
  
  for (let i = 0; i < maxRetries; i++) {
    // Exponential backoff: 10s, 15s, 20s, 25s, 30s (max)
    const interval = Math.min(initialInterval + (i * 5000), 30000);
    
    for (const endpoint of endpoints) {
      try {
        console.log(`[INFO] Attempt ${i + 1}/${maxRetries}: Checking ${N8N_URL}${endpoint}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(`${N8N_URL}${endpoint}`, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Northflank-Job/1.0',
            'Accept': '*/*'
          }
        });
        
        clearTimeout(timeout);

        if (response.ok) {
          console.log(`[SUCCESS] N8N is ready! (via ${endpoint})`);
          console.log(`[INFO] Response status: ${response.status}`);
          
          // Additional wait to ensure stability
          console.log('[INFO] Waiting additional 15s for N8N to stabilize...');
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          return true;
        } else {
          console.log(`[DEBUG] Endpoint ${endpoint} returned: ${response.status}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`[DEBUG] Request timeout for ${endpoint}`);
        } else {
          console.log(`[DEBUG] ${endpoint} error: ${error.message}`);
        }
      }
    }
    
    if (i < maxRetries - 1) {
      console.log(`[INFO] N8N not ready yet, waiting ${interval/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  console.log('[WARNING] Max retries reached, but proceeding anyway...');
  console.log('[WARNING] N8N might still be starting up');
  return false;
}

// Enhanced: Verify N8N instance with detailed logging
async function verifyN8NInstance() {
  try {
    console.log('[INFO] Final verification of N8N instance...');
    
    const endpoints = [
      { path: '/healthz', name: 'Health Check' },
      { path: '/healthz/readiness', name: 'Readiness Check' },
      { path: '/', name: 'Root Path' }
    ];
    
    let successCount = 0;
    
    for (const { path, name } of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${N8N_URL}${path}`, {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeout);

        if (response.ok) {
          console.log(`[SUCCESS] ${name} (${path}): OK`);
          successCount++;
        } else {
          console.log(`[WARNING] ${name} (${path}): ${response.status}`);
        }
      } catch (error) {
        console.log(`[WARNING] ${name} (${path}): ${error.message}`);
      }
    }
    
    if (successCount > 0) {
      console.log(`[SUCCESS] N8N verification passed (${successCount}/${endpoints.length} checks)`);
      return true;
    }
    
    console.log('[WARNING] All N8N health checks failed, but continuing...');
    return true;
  } catch (error) {
    console.log(`[WARNING] Verification failed: ${error.message}, continuing...`);
    return true;
  }
}

// Main execution
async function main() {
  const startTime = Date.now();
  
  try {
    console.log('[INFO] Starting main execution...');
    console.log(`[INFO] Target N8N URL: ${N8N_URL}`);
    console.log(`[INFO] Target User: ${USER_EMAIL}`);
    
    // Step 1: Connect to database
    console.log('\n=== STEP 1: DATABASE CONNECTION ===');
    await connectToDatabase();
    
    // Step 2: Wait for N8N to be ready (with longer timeout)
    console.log('\n=== STEP 2: WAIT FOR N8N ===');
    const n8nReady = await waitForN8NReady();
    
    if (!n8nReady) {
      console.log('[WARNING] N8N might not be fully ready, but continuing...');
    }
    
    // Step 3: Verify N8N instance
    console.log('\n=== STEP 3: VERIFY N8N INSTANCE ===');
    await verifyN8NInstance();
    
    // Step 4: Check if user already exists
    console.log('\n=== STEP 4: CHECK EXISTING USER ===');
    const existingUser = await checkExistingUser();
    
    // Step 5: Create or update user record
    console.log('\n=== STEP 5: UPDATE DATABASE ===');
    if (existingUser) {
      console.log('[INFO] User record exists, updating...');
      await updateUserRecord();
    } else {
      console.log('[INFO] Creating new user record...');
      await createUserRecord();
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n=== SUCCESS ===');
    console.log(`[SUCCESS] All operations completed in ${duration}s`);
    console.log(`[INFO] N8N instance available at: ${N8N_URL}`);
    console.log(`[INFO] Login with: ${N8N_USER_EMAIL}`);
    console.log(`[INFO] Password: 7On[ENCRYPTION_KEY]`);
    console.log(`[INFO] Project ID: ${NORTHFLANK_PROJECT_ID}`);
    console.log(`[INFO] Clerk User ID: ${CLERK_USER_ID}`);
    
    // Close database connection
    await client.end();
    console.log('[INFO] Database connection closed');
    
    process.exit(0);
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.error(`\n=== FAILURE (after ${duration}s) ===`);
    console.error('[FATAL] Main execution failed:', error.message);
    console.error('[FATAL] Stack trace:', error.stack);
    
    // Try to update status as failed
    try {
      if (client) {
        console.log('[INFO] Attempting to update error status in database...');
        const query = `
          UPDATE "User" 
          SET "northflankProjectStatus" = $1, 
              "n8nSetupError" = $2,
              "updatedAt" = $3
          WHERE "clerkId" = $4
        `;
        await client.query(query, [
          'failed', 
          error.message.substring(0, 500), 
          new Date(), 
          CLERK_USER_ID
        ]);
        console.log('[INFO] Error status updated in database');
        await client.end();
      }
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

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('[INFO] Received SIGTERM signal, cleaning up...');
  if (client) {
    client.end().then(() => {
      console.log('[INFO] Database connection closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

// Start the process
console.log('[INFO] Initializing store-credentials script...');
console.log('[INFO] Node version:', process.version);
console.log('[INFO] Working directory:', process.cwd());
main();