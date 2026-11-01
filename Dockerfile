# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY . .
RUN npm run build

# ---- run ----
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/rfq.db WEB_DIR=/app/frontend/dist
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev -w backend && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/db backend/db
COPY --from=build /app/frontend/dist frontend/dist
VOLUME /data
EXPOSE 8080
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "backend/dist/server.js"]
