FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN cd apps/api && /app/node_modules/.bin/webpack --mode production

CMD ["node", "dist/apps/api/main.js"]