FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# PENTING: Generate prisma client sesuai path lo
RUN npx prisma generate --schema=src/shared/database/prisma/schema.prisma

RUN npm run build

EXPOSE 3001

CMD ["npm", "run", "start:prod"]