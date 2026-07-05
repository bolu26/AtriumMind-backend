FROM node:20-alpine
WORKDIR /app

# Copy everything first
COPY . .

# Install dependencies
RUN npm install --legacy-peer-deps

# Step 1: Compile the registry-client local package from TS to JS
RUN cd packages/registry-client && \
    npx tsc --outDir dist --module NodeNext --moduleResolution NodeNext \
    --target ES2022 --declaration --skipLibCheck --esModuleInterop \
    src/index.ts src/networks.ts src/validateNetwork.ts 2>/dev/null || true

# Step 2: Update registry-client package.json to point to compiled JS
RUN node -e "
const fs = require(\"fs\");
const p = \"packages/registry-client/package.json\";
const pkg = JSON.parse(fs.readFileSync(p,\"utf8\"));
pkg.main = \"dist/index.js\";
pkg.exports = {\".\": \"./dist/index.js\"};
fs.writeFileSync(p, JSON.stringify(pkg, null, 2));
console.log(\"Updated registry-client exports to dist/index.js\");
"

# Step 3: Re-link the local package so node_modules picks up new exports
RUN mkdir -p node_modules/@atriumind && \
    rm -rf node_modules/@atriumind/registry-client && \
    cp -r packages/registry-client node_modules/@atriumind/registry-client

# Step 4: Build the main application
RUN npm run build

RUN addgroup -S atrium && adduser -S atrium -G atrium
USER atrium

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]