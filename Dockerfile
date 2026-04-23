FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN NX_DAEMON=false pnpm nx build api --verbose

CMD ["node", "dist/apps/api/main.js"]