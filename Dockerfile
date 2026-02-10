# --- STAGE 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy Prisma schema agar caching layer install lebih efisien
COPY src/shared/database/prisma ./src/shared/database/prisma/

# Install dependencies (termasuk devDependencies untuk build)
RUN npm install

# Copy semua source code
COPY . .

# Generate Prisma Client & Build Production
RUN npx prisma generate --schema=./src/shared/database/prisma/schema.prisma
RUN npm run build

# --- STAGE 2: Runtime ---
FROM node:20-alpine

WORKDIR /app

# Copy hasil build dan node_modules yang sudah jadi dari stage builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src/shared/database/prisma ./src/shared/database/prisma/

# Set environment variables default
ENV PORT=3001
ENV NODE_ENV=production

# Expose port agar Koyeb tahu jalur trafficnya
EXPOSE 3001

# Menggunakan sh -c agar bisa menjalankan dua perintah sekaligus
CMD ["sh", "-c", "npx prisma db push --schema=./src/shared/database/prisma/schema.prisma && node dist/main"]