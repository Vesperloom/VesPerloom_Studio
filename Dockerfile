FROM node:22-bookworm-slim AS builder
WORKDIR /opt/vesperloom
COPY package*.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev --no-audit --no-fund
ARG WITH_LOCAL_CHAT=0
RUN if [ "$WITH_LOCAL_CHAT" = "1" ]; then npm ci --prefix runtimes/chat-linux-x64 --omit=optional --ignore-scripts --no-audit --no-fund && node runtimes/chat-linux-x64/check.mjs; fi

FROM node:22-bookworm-slim
WORKDIR /opt/vesperloom
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173 VESPER_HOME=/data
COPY --from=builder /opt/vesperloom/node_modules ./node_modules
COPY --from=builder /opt/vesperloom/app/dist ./app/dist
COPY --from=builder /opt/vesperloom/server ./server
COPY --from=builder /opt/vesperloom/engine ./engine
COPY --from=builder /opt/vesperloom/registry ./registry
COPY --from=builder /opt/vesperloom/bin ./bin
COPY --from=builder /opt/vesperloom/runtimes ./runtimes
COPY --from=builder /opt/vesperloom/tools/workspaces.mjs ./tools/workspaces.mjs
COPY --from=builder /opt/vesperloom/package.json ./
COPY --from=builder /opt/vesperloom/LICENSE /opt/vesperloom/THIRD_PARTY_NOTICES.md ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4173/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/main.mjs"]
