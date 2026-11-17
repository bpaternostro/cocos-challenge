FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

USER node

EXPOSE 3000

CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
