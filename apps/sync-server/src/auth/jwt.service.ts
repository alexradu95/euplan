import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { config } from '../config/environment';

export interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtService {
  private readonly logger = new Logger(JwtService.name);
  private readonly jwtSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.jwtSecret = config.get('JWT_SECRET');
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      if (!token || typeof token !== 'string') {
        this.logger.warn('Invalid token format provided');
        return null;
      }
      
      // Check token length to prevent DoS
      if (token.length > 2048) {
        this.logger.warn('Token too long, possible DoS attempt');
        return null;
      }
      
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'], // Restrict to secure algorithms
        issuer: 'euplan-app',
        maxAge: '24h', // Maximum token age
      }) as JWTPayload;
      
      // Validate token structure
      if (!decoded.userId || !decoded.email) {
        this.logger.warn('Token missing required claims');
        return null;
      }
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.warn('JWT verification failed', {
          error: error.name,
          message: error.message,
        });
      } else {
        this.logger.error('Unexpected error during JWT verification', error);
      }
      return null;
    }
  }

  extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}