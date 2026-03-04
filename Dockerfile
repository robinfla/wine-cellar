FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache python3 make g++ && \
    mkdir -p /app/kb-deps && cd /app/kb-deps && \
    npm init -y > /dev/null 2>&1 && \
    npm install better-sqlite3 > /dev/null 2>&1 && \
    apk del python3 make g++ 2>/dev/null; true
WORKDIR /app
COPY --from=builder /app/.output .output
# Link the properly compiled better-sqlite3 into the output
RUN if [ -d .output/server/node_modules/better-sqlite3 ]; then \
      rm -rf .output/server/node_modules/better-sqlite3; \
    fi && \
    ln -s /app/kb-deps/node_modules/better-sqlite3 .output/server/node_modules/better-sqlite3
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
