FROM node:20-alpine
WORKDIR /app

# Copy ALL source files first (so npm workspaces can find packages/)
COPY . .

# Install all dependencies including workspace packages
RUN npm install --legacy-peer-deps

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --omit=dev --legacy-peer-deps

# Security: non-root user
RUN addgroup -S atrium && adduser -S atrium -G atrium
USER atrium

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]