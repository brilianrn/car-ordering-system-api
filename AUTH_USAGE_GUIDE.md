# Strict Auth & RBAC Module - Usage Guide

## Authentication

### Register New Account

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@dp.dharmap.com",
    "password": "securePassword123",
    "nik": "ADM999"
  }'
```

**Response (Success):**

```json
{
  "message": "Registration successful. Please verify your email to activate your account.",
  "email": "john.doe@dp.dharmap.com"
}
```

**Response (Invalid Domain):**

```json
{
  "statusCode": 400,
  "message": "Email must be from domain: @dp.dharmap.com"
}
```

### Login

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@cos.dharma.co.id",
    "password": "admin123"
  }'
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "employeeId": "ADM999",
    "email": "superadmin@cos.dharma.co.id",
    "fullName": "Super Admin",
    "roles": ["ADMIN"]
  }
}
```

---

## Usage in Controllers

### Protecting Endpoints with JWT

```typescript
import { JwtAuthGuard } from '@/packages/auth/guards';
import { Controller, Get, UseGuards } from '@nestjs/common';

@Controller('api/v1/protected')
export class ProtectedController {
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile() {
    return { message: 'This endpoint requires authentication' };
  }
}
```

### Role-Based Access Control

```typescript
import { JwtAuthGuard, RolesGuard } from '@/packages/auth/guards';
import { Roles } from '@/packages/auth/decorators';
import { Controller, Get, Post, UseGuards } from '@nestjs/common';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard) // Apply both guards
export class AdminController {
  @Roles('ADMIN') // Only ADMIN role can access
  @Post('settings')
  updateSettings() {
    return { message: 'Settings updated' };
  }

  @Roles('ADMIN', 'GA') // ADMIN or GA role can access
  @Get('reports')
  getReports() {
    return { message: 'Admin reports' };
  }
}
```

### Multiple Roles (Array Intersection)

```typescript
@Roles('USER', 'LEADER', 'ADMIN')
@Get('dashboard')
getDashboard() {
  // Accessible if user has at least ONE of: USER, LEADER, or ADMIN
  return { data: 'Dashboard data' };
}
```

---

## Testing RBAC

### 1. Login as Super Admin

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "superadmin@cos.dharma.co.id", "password": "admin123"}'
```

Save the `accessToken` from response.

### 2. Access Protected Endpoint

```bash
curl -X GET http://localhost:3001/api/v1/admin/settings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Test Unauthorized Access

```bash
# Without token → 401 Unauthorized
curl -X GET http://localhost:3001/api/v1/admin/settings

# With token but wrong role → 403 Forbidden
curl -X GET http://localhost:3001/api/v1/admin/settings \
  -H "Authorization: Bearer USER_TOKEN_WITHOUT_ADMIN_ROLE"
```

---

## Available Roles

Based on the `effectiveRoles` in Employee model:

- `ADMIN` - System administrators
- `GA` - General Affairs
- `USER` - Regular users
- `LEADER` - Department leaders
- (Add more as needed in your RBAC configuration)

---

## Security Notes

1. **Email Domain**: Only emails from `@dp.dharmap.com` (or configured domain) can register.
2. **NIK Validation**: NIK must exist in the `Employee` table.
3. **Email Verification**: Accounts start as `isVerified: false` and cannot login until verified.
4. **JWT Expiry**: Tokens expire after 1 day (configurable in `AuthModule`).
5. **Password Security**: Passwords are hashed using bcryptjs with salt rounds = 10.
