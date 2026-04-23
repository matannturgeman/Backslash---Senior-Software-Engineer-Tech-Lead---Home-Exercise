FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN cd apps/api && npx webpack --mode production

CMD ["node", "dist/apps/api/main.js"]