# --- STAGE 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema dulu biar layer install lebih cepat
COPY src/shared/database/prisma ./src/shared/database/prisma/

# Install dependencies (termasuk prisma)
RUN npm install

# Copy source code (Pastikan ada .dockerignore biar .env gak ikut)
COPY . .

# Generate Prisma Client & Build
RUN npx prisma generate --schema=./src/shared/database/prisma/schema.prisma
RUN npm run build

# --- STAGE 2: Runtime ---
FROM node:20-alpine

WORKDIR /app

# Ambil hasil build dan dependencies dari builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src/shared/database/prisma ./src/shared/database/prisma/

# Set environment variables default
ENV PORT=3001
ENV NODE_ENV=production
EXPOSE 3001

# Jalankan aplikasi
CMD ["node", "dist/src/main"]