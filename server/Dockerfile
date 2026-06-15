FROM node:20-alpine AS base
WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src

EXPOSE 3000
# NODE_ENV is intentionally NOT set here — it is injected by docker-compose
# (development for local, production for prod deployments) so that the same
# image works correctly in both environments without rebuilding.

# Only run the server — migrations are handled by the migrate service
CMD ["node", "src/index.js"]