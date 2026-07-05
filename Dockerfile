FROM node:20-alpine
WORKDIR /app

# Copy everything
COPY . .

# Install ALL deps (no prune - registry-client is a local package needed at runtime)
RUN npm install --legacy-peer-deps

# Build TypeScript
RUN npm run build

# Copy the local packages into node_modules so Node can find them at runtime
RUN mkdir -p node_modules/@atriumind && \
    cp -r packages/registry-client node_modules/@atriumind/registry-client

RUN addgroup -S atrium && adduser -S atrium -G atrium
USER atrium

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]