FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm install --legacy-peer-deps
RUN NX_DAEMON=false npx nx build api

CMD ["node", "dist/apps/api/main.js"]
