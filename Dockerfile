# syntax=docker/dockerfile:1
# One parameterized image for every service in the monorepo:
#   docker build --build-arg APP=work-orders-service -t propflow/work-orders-service .

FROM node:22-alpine AS build
ARG APP
WORKDIR /workspace
COPY package.json package-lock.json nest-cli.json tsconfig.json tsconfig.build.json ./
RUN npm ci
COPY apps ./apps
COPY libs ./libs
RUN npm run build ${APP} \
  # Dev dependencies (nest cli, webpack, jest, ...) are build-time only.
  && npm prune --omit=dev

FROM node:22-alpine
ARG APP
ENV NODE_ENV=production
WORKDIR /app
USER node
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/dist/apps/${APP} ./dist
CMD ["node", "dist/main"]
