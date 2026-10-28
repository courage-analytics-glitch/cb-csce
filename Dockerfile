FROM node:22-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@10.18.0
COPY . .
RUN test -f package.json && test -f pnpm-lock.yaml && test -f pnpm-workspace.yaml && pnpm --version && pnpm install --frozen-lockfile --prod=false && pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
