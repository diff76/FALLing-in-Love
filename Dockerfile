# Portable build for either app. Build with:
#   docker build --build-arg APP=web -t fil-web .
#   docker build --build-arg APP=ops -t fil-ops .
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY apps/ops/package.json apps/ops/
COPY packages/config/package.json packages/config/
COPY packages/domain/package.json packages/domain/
COPY packages/supabase/package.json packages/supabase/
RUN npm ci

FROM node:20-alpine AS build
ARG APP=web
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@fil/${APP}

FROM node:20-alpine AS run
ARG APP=web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/${APP}/.next/standalone ./
COPY --from=build /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=build /repo/apps/${APP}/public ./apps/${APP}/public
EXPOSE 3000
ENV PORT=3000
CMD ["sh", "-c", "node apps/*/server.js"]
