import { JwtService } from '@nestjs/jwt';

export interface ActionTokenPayload {
  bookingId: number;
  approverId: string;
  action: 'APPROVE' | 'REJECT';
  level: 'L1' | 'L2';
  iat?: number;
  exp?: number;
}

export interface DecodedActionToken extends ActionTokenPayload {
  iat: number;
  exp: number;
}

const jwtService = new JwtService({
  secret: process.env.JWT_SECRET,
});

/**
 * Generate a JWT action token for approval/rejection
 * Token expires in 7 days
 */
export const generateActionToken = (payload: ActionTokenPayload): string => {
  return jwtService.sign(payload, {
    expiresIn: '7d',
  });
};

/**
 * Verify and decode an action token
 * Throws error if token is invalid or expired
 */
export const verifyActionToken = (token: string): DecodedActionToken => {
  try {
    const decoded = jwtService.verify<DecodedActionToken>(token);
    return decoded;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Action token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid action token');
      }
    }
    throw new Error('Failed to verify action token');
  }
};
