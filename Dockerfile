# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install all deps (including devDeps for build)
COPY package.json ./
RUN npm install --workspaces --include-workspace-root --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy package manifests and install production deps only
COPY package.json ./
COPY --from=builder /app/packages ./packages
RUN npm install --workspaces --include-workspace-root --omit=dev --legacy-peer-deps

# Copy compiled output
COPY --from=builder /app/dist ./dist
COPY drizzle ./drizzle

# Non-root user for security
RUN addgroup -S atrium && adduser -S atrium -G atrium
USER atrium

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
