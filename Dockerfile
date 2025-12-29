# --- STAGE 1: Build ---
  FROM node:20-alpine AS builder

  WORKDIR /app
  
  # Copy package files for dependency installation
  COPY package*.json ./
  
  # Copy Prisma schema according to the project structure
  COPY src/shared/database/prisma ./src/shared/database/prisma/
  
  # Install all dependencies
  RUN npm install
  
  # Copy the entire source code
  COPY . .
  
  # Generate Prisma Client (build time)
  RUN npx prisma generate --schema=./src/shared/database/prisma/schema.prisma
  
  # Build the NestJS application
  RUN npm run build
  
  # --- STAGE 2: Runtime ---
  FROM node:20-alpine
  
  WORKDIR /app
  
  # Copy built files and node_modules from the builder stage
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  COPY --from=builder /app/package*.json ./
  
  # Copy prisma folder for runtime migrations
  COPY --from=builder /app/src/shared/database/prisma ./src/shared/database/prisma/
  
  # Set environment variables
  ENV PORT=3001
  ENV NODE_ENV=production
  EXPOSE 3001
  
  # BEST PRACTICE: Run database migration then start the app
  # This ensures your 'booking' table is created automatically on AWS
  CMD ["sh", "-c", "npx prisma db push --schema=./src/shared/database/prisma/schema.prisma && node dist/src/main"]