#!/usr/bin/env node

/**
 * Store N8N Credentials Script
 * This script sends N8N instance credentials to Neon Database
 */

import pg from 'pg';
const { Client } = pg;

console.log('[INFO] Starting N8N credentials storage process...');

// Get environment variables
const DATABASE_URL = process.env.DATABASE_URL; // Neon connection string
const CLERK_USER_ID = process.env.CLERK_USER_ID; // Clerk User ID
const USER_EMAIL = process.env.USER_EMAIL; // User's email
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
      }
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
    
    // Prisma uses "User" table name with camelCase fields
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
    
    // Generate a cuid-like ID (simplified version)
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
      userId,                           // id
      CLERK_USER_ID,                    // clerkId
      USER_EMAIL,                       // email
      'FREE',                           // subscriptionTier
      0,                                // apiCallsCount
      now,                              // usageResetAt
      N8N_URL,                          // n8nUrl
      N8N_USER_EMAIL,                   // n8nUserEmail
      N8N_ENCRYPTION_KEY,               // n8nEncryptionKey
      NORTHFLANK_PROJECT_ID,            // northflankProjectId
      NORTHFLANK_PROJECT_NAME || 'N8N Instance', // northflankProjectName
      'ready',                          // northflankProjectStatus
      now,                              // northflankCreatedAt
      now,                              // templateCompletedAt
      now,                              // createdAt
      now                               // updatedAt
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
      CLERK_USER_ID,                    // clerkId (WHERE clause)
      USER_EMAIL,                       // email
      N8N_URL,                          // n8nUrl
      N8N_USER_EMAIL,                   // n8nUserEmail
      N8N_ENCRYPTION_KEY,               // n8nEncryptionKey
      NORTHFLANK_PROJECT_ID,            // northflankProjectId
      NORTHFLANK_PROJECT_NAME || 'N8N Instance', // northflankProjectName
      'ready',                          // northflankProjectStatus
      now,                              // northflankCreatedAt
      now,                              // templateCompletedAt
      now                               // updatedAt
    ];
    
    const result = await client.query(query, values);
    console.log('[SUCCESS] User record updated successfully!');
    return result.rows[0];
  } catch (error) {
    console.error('[ERROR] Failed to update user record:', error.message);
    throw error;
  }
}

// Function to verify N8N instance is accessible
async function verifyN8NInstance() {
  try {
    console.log('[INFO] Verifying N8N instance accessibility...');
    
    const endpoints = ['/healthz', '/healthz/readiness', '/'];
    
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${N8N_URL}${endpoint}`, {
          method: 'GET',
          signal: controller.signal
        });
        
        clearTimeout(timeout);

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
    return true;
  } catch (error) {
    console.log(`[WARNING] N8N verification failed: ${error.message}, but continuing...`);
    return true;
  }
}

// Function to wait for N8N to be fully ready
async function waitForN8NReady(maxRetries = 12, interval = 10000) {
  console.log('[INFO] Waiting for N8N to be fully ready...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${N8N_URL}/healthz/readiness`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeout);

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
    
    // Step 1: Connect to database
    await connectToDatabase();
    
    // Step 2: Wait for N8N to be ready
    await waitForN8NReady();
    
    // Step 3: Verify N8N instance
    await verifyN8NInstance();
    
    // Step 4: Check if user already exists
    const existingUser = await checkExistingUser();
    
    // Step 5: Create or update user record
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
    console.log(`[INFO] Clerk User ID: ${CLERK_USER_ID}`);
    
    // Close database connection
    await client.end();
    console.log('[INFO] Database connection closed');
    
    process.exit(0);
    
  } catch (error) {
    console.error('[FATAL] Main execution failed:', error.message);
    console.error('[FATAL] Stack trace:', error.stack);
    
    // Try to update status as failed
    try {
      if (client) {
        const query = `
          UPDATE "User" 
          SET "northflankProjectStatus" = $1, 
              "n8nSetupError" = $2,
              "updatedAt" = $3
          WHERE "clerkId" = $4
        `;
        await client.query(query, [
          'failed', 
          error.message, 
          new Date(), 
          CLERK_USER_ID
        ]);
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

// Start the process
console.log('[INFO] Initializing...');
main();
