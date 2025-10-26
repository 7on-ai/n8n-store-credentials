# Use Node.js Alpine for better JSON handling and HTTP requests
FROM node:18-alpine

# Install curl as backup
RUN apk add --no-cache curl

# Create app directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies with verbose logging
RUN npm ci --only=production --verbose || \
    (npm install --only=production --verbose && echo "Fallback to npm install succeeded") && \
    npm cache clean --force

# Copy the main script with .mjs extension
COPY store-credentials.mjs .

# Make sure we have proper permissions
RUN chmod +x store-credentials.mjs

# Verify the file exists
RUN ls -la /app/

# Set the entrypoint to use .mjs file
ENTRYPOINT ["node", "/app/store-credentials.mjs"]