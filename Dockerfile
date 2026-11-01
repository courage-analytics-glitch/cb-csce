FROM node:22-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@10.18.0
# Public by design: Vite inlines it into the client bundle. Never pass CLERK_SECRET_KEY as a build arg.
ARG CLERK_PUBLISHABLE_KEY
COPY . .
RUN test -n "$CLERK_PUBLISHABLE_KEY" || { echo "Build arg CLERK_PUBLISHABLE_KEY is required." >&2; exit 1; }
RUN test -f package.json && test -f pnpm-lock.yaml && test -f pnpm-workspace.yaml && pnpm --version && pnpm install --frozen-lockfile --prod=false && CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY" pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
