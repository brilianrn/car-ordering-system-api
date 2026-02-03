import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from @Roles decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from request (attached by JWT strategy)
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.roles) {
      return false;
    }

    // Check if user has at least one of the required roles (array intersection)
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    return hasRole;
  }
}
