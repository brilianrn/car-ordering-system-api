import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'src/shared/database/prisma/schema.prisma',
  migrations: {
    path: 'src/shared/database/prisma/migrations',
  },
  datasource: {
    // url: env('DATABASE_URL'),
    // url: 'postgresql://postgres_sa:M4Z!xQ9#7A2@database-carorder.cxmghewxz03v.ap-southeast-3.rds.amazonaws.com:5432/postgres?schema=public',
    // url: 'postgresql://postgres_sa:M4Z!xQ9%237A2@database-carorder.cxmghewxz03v.ap-southeast-3.rds.amazonaws.com:5432/postgres?schema=public',
    url: process.env.DATABASE_URL,
  },
});
