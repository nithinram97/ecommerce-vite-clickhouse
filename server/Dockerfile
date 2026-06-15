FROM node:20-alpine AS base
WORKDIR /app

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src ./src

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
