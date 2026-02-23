import * as dotenv from 'dotenv';
import * as jwt from 'jsonwebtoken';
import * as path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env');
const result = dotenv.config({ path: envPath });

console.log('Loading .env from:', envPath);
if (result.error) {
  console.error('Error loading .env:', result.error);
  process.exit(1);
}

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('❌ JWT_SECRET is missing in .env');
  process.exit(1);
}
console.log('✅ JWT_SECRET found in .env');

// Payload matching JwtStrategy expectations
const payload = {
  sub: 'debug-user-id',
  employeeId: 'EMP-DEBUG-001',
  email: 'debug@example.com',
  roles: ['GA', 'ADMIN', 'DRIVER'], // Give all roles primarily to pass guards
};

try {
  const token = jwt.sign(payload, secret, { expiresIn: '1d' });
  console.log('\n✅ Generated Valid Backend Token:\n');
  console.log(token);
  console.log('\n👉 Use this token in "Authorization: Bearer <token>" to test the endpoint.');
} catch (error) {
  console.error('Error signing token:', error);
}
