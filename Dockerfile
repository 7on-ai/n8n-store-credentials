# Use Node.js Alpine for better JSON handling and HTTP requests
FROM node:18-alpine

# Install curl and other utilities
RUN apk add --no-cache curl

# Create app directory
RUN mkdir -p /app
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY store-credentials.js .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of app directory
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Set the entrypoint
ENTRYPOINT ["node", "/app/store-credentials.js"]
