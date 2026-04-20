FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm install -g pnpm
RUN pnpm install
RUN pnpm nx build api

CMD ["node", "dist/apps/api/main.js"]