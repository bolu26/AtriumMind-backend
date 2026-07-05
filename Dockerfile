FROM node:20-alpine
WORKDIR /app

# registry-client has pre-compiled dist/index.js — no tsc needed: 1783292890
COPY . .
RUN npm install --legacy-peer-deps
RUN mkdir -p node_modules/@atriumind && \
    rm -rf node_modules/@atriumind/registry-client && \
    cp -r packages/registry-client node_modules/@atriumind/registry-client && \
    echo 'registry-client linked'
RUN rm -rf dist && npm run build
RUN addgroup -S atrium && adduser -S atrium -G atrium
USER atrium
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]