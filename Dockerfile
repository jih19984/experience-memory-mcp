FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV PORT=8000
ENV MCP_EMBEDDED_POSTGRES=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-15 postgresql-client-15 \
  && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY schema.sql ./schema.sql
COPY scripts/start-kc.sh ./scripts/start-kc.sh
RUN chmod +x ./scripts/start-kc.sh
EXPOSE 8000
CMD ["./scripts/start-kc.sh"]
