# Use Node.js Alpine for better JSON handling and HTTP requests
FROM node:18-alpine

# Install curl as backup
RUN apk add --no-cache curl

# Create app directory
WORKDIR /app

# Create the main script
COPY store-credentials.js .

# Make sure we have proper permissions
RUN chmod +x store-credentials.js

# Set the entrypoint
ENTRYPOINT ["node", "/app/store-credentials.js"]
