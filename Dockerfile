# ==========================================================================
# SANARIO PRODUCTION DOCKERFILE
# Multi-stage/lightweight Node.js container setup
# ==========================================================================

# 1. Base Image
FROM node:20-alpine AS base

# 2. Set working directory
WORKDIR /app

# 3. Copy dependency definitions
COPY package*.json ./

# 4. Install production dependencies (ignores devDependencies)
RUN npm install --omit=dev

# 5. Copy application source code
COPY . .

# 6. Expose the server application port
EXPOSE 3000

# 7. Define environment defaults (can be overridden by hosting provider)
ENV NODE_ENV=production
ENV PORT=3000

# 8. Start the Express server
CMD ["node", "server.js"]
