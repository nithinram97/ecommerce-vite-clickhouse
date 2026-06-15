FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./

# In development we need devDependencies (nodemon) so install everything.
# In production we skip them with --omit=dev.
RUN if [ "$NODE_ENV" = "production" ]; then \
      npm install --omit=dev; \
    else \
      npm install; \
    fi

COPY src ./src

EXPOSE 3000

# Use nodemon in development so file syncs from `docker compose watch` trigger
# automatic restarts without a full image rebuild.
# In production, run node directly.
CMD if [ "$NODE_ENV" = "production" ]; then \
      node src/index.js; \
    else \
      npx nodemon --watch src src/index.js; \
    fi