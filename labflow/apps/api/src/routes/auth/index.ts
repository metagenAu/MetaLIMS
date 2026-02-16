import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@labflow/db';

const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory failed attempt tracking (use Redis in production for distributed deploys)
const failedAttempts = new Map<string, { count: number; lastAttempt: Date; lockedUntil?: Date }>();

// Password complexity: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,128}$/;

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128).refine(
    (val) => PASSWORD_REGEX.test(val),
    { message: 'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character' },
  ),
});

function checkAccountLockout(email: string): { locked: boolean; retryAfterSeconds?: number } {
  const record = failedAttempts.get(email);
  if (!record) return { locked: false };

  if (record.lockedUntil && record.lockedUntil > new Date()) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil.getTime() - Date.now()) / 1000);
    return { locked: true, retryAfterSeconds };
  }

  // Lockout expired, reset
  if (record.lockedUntil && record.lockedUntil <= new Date()) {
    failedAttempts.delete(email);
  }
  return { locked: false };
}

function recordFailedAttempt(email: string): void {
  const record = failedAttempts.get(email) || { count: 0, lastAttempt: new Date() };
  record.count += 1;
  record.lastAttempt = new Date();

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }

  failedAttempts.set(email, record);
}

function clearFailedAttempts(email: string): void {
  failedAttempts.delete(email);
}

const routes: FastifyPluginAsync = async (fastify) => {
  // POST /login
  fastify.post('/login', async (request, reply) => {
    try {
      const body = LoginSchema.parse(request.body);
      const email = body.email.toLowerCase();

      // Check account lockout
      const lockout = checkAccountLockout(email);
      if (lockout.locked) {
        return reply.status(429).send({
          error: {
            code: 'ACCOUNT_LOCKED',
            message: `Account temporarily locked due to too many failed attempts. Try again in ${lockout.retryAfterSeconds} seconds.`,
            details: null,
          },
        });
      }

      const user = await prisma.user.findFirst({
        where: {
          email,
          deletedAt: null,
        },
        include: { organization: true },
      });

      if (!user || !user.isActive) {
        recordFailedAttempt(email);
        return reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            details: null,
          },
        });
      }

      const passwordValid = await bcrypt.compare(body.password, user.passwordHash);
      if (!passwordValid) {
        recordFailedAttempt(email);
        return reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            details: null,
          },
        });
      }

      // Successful login — clear failed attempts
      clearFailedAttempts(email);

      // Sign access token using @fastify/jwt with standardized claims
      const accessToken = fastify.jwt.sign(
        {
          sub: user.id,
          orgId: user.organizationId,
          email: user.email,
          role: user.role,
        },
        { expiresIn: ACCESS_TOKEN_EXPIRY },
      );

      // Sign refresh token using @fastify/jwt
      const refreshToken = fastify.jwt.sign(
        {
          sub: user.id,
          orgId: user.organizationId,
          type: 'refresh',
        },
        { expiresIn: REFRESH_TOKEN_EXPIRY },
      );

      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      await prisma.refreshToken.create({
        data: {
          tokenHash: refreshTokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          action: 'LOGIN',
          entityType: 'User',
          entityId: user.id,
          changes: { event: 'login' },
          metadata: { ip: request.ip },
        },
      });

      return reply.send({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organization.name,
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: err.errors,
          },
        });
      }
      throw err;
    }
  });

  // POST /refresh
  fastify.post('/refresh', async (request, reply) => {
    try {
      const body = RefreshSchema.parse(request.body);

      // Verify the refresh token using @fastify/jwt
      let decoded: { sub: string; orgId: string; type?: string };
      try {
        decoded = fastify.jwt.verify<{ sub: string; orgId: string; type?: string }>(body.refreshToken);
      } catch {
        return reply.status(401).send({
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token is invalid or expired',
            details: null,
          },
        });
      }

      const tokenHash = crypto
        .createHash('sha256')
        .update(body.refreshToken)
        .digest('hex');

      const storedToken = await prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
        // Possible token reuse attack — revoke all tokens for this user
        if (storedToken?.revokedAt) {
          await prisma.refreshToken.updateMany({
            where: { userId: decoded.sub, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        return reply.status(401).send({
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token is invalid or has been revoked',
            details: null,
          },
        });
      }

      // Revoke old refresh token (rotation)
      await prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.isActive || user.deletedAt) {
        return reply.status(401).send({
          error: {
            code: 'USER_INACTIVE',
            message: 'User account is deactivated',
            details: null,
          },
        });
      }

      const newAccessToken = fastify.jwt.sign(
        {
          sub: user.id,
          orgId: user.organizationId,
          email: user.email,
          role: user.role,
        },
        { expiresIn: ACCESS_TOKEN_EXPIRY },
      );

      const newRefreshToken = fastify.jwt.sign(
        {
          sub: user.id,
          orgId: user.organizationId,
          type: 'refresh',
        },
        { expiresIn: REFRESH_TOKEN_EXPIRY },
      );

      const newRefreshTokenHash = crypto
        .createHash('sha256')
        .update(newRefreshToken)
        .digest('hex');

      await prisma.refreshToken.create({
        data: {
          tokenHash: newRefreshTokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return reply.send({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: err.errors,
          },
        });
      }
      throw err;
    }
  });

  // POST /logout
  fastify.post('/logout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const body = z.object({ refreshToken: z.string().optional() }).parse(request.body);

    if (body.refreshToken) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(body.refreshToken)
        .digest('hex');

      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      // Revoke all refresh tokens for the user
      await prisma.refreshToken.updateMany({
        where: { userId: request.user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: request.user.id,
        changes: { event: 'logout' },
      },
    });

    return reply.send({ message: 'Logged out successfully' });
  });

  // POST /forgot-password
  fastify.post('/forgot-password', async (request, reply) => {
    try {
      const body = ForgotPasswordSchema.parse(request.body);

      const user = await prisma.user.findFirst({
        where: {
          email: body.email.toLowerCase(),
          deletedAt: null,
        },
      });

      // Always return success to prevent email enumeration
      if (!user || !user.isActive) {
        return reply.send({
          message: 'If the email exists, a password reset link has been sent.',
        });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      await prisma.passwordResetToken.create({
        data: {
          tokenHash: resetTokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      });

      // In production, send email with reset link containing resetToken
      fastify.log.info(
        { userId: user.id },
        'Password reset token generated (send via email in production)'
      );

      await prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'User',
          entityId: user.id,
          changes: { event: 'password_reset_requested' },
        },
      });

      return reply.send({
        message: 'If the email exists, a password reset link has been sent.',
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: err.errors,
          },
        });
      }
      throw err;
    }
  });

  // POST /reset-password
  fastify.post('/reset-password', async (request, reply) => {
    try {
      const body = ResetPasswordSchema.parse(request.body);

      const tokenHash = crypto
        .createHash('sha256')
        .update(body.token)
        .digest('hex');

      const resetRecord = await prisma.passwordResetToken.findFirst({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!resetRecord) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_RESET_TOKEN',
            message: 'Reset token is invalid or has expired',
            details: null,
          },
        });
      }

      const passwordHash = await bcrypt.hash(body.password, 12);

      await prisma.$transaction([
        prisma.user.update({
          where: { id: resetRecord.userId },
          data: { passwordHash },
        }),
        prisma.passwordResetToken.update({
          where: { id: resetRecord.id },
          data: { usedAt: new Date() },
        }),
        // Revoke all refresh tokens for the user (force re-login)
        prisma.refreshToken.updateMany({
          where: { userId: resetRecord.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
      ]);

      const user = await prisma.user.findUnique({
        where: { id: resetRecord.userId },
      });

      if (user) {
        await prisma.auditLog.create({
          data: {
            organizationId: user.organizationId,
            userId: user.id,
            action: 'PASSWORD_RESET_COMPLETED',
            entityType: 'User',
            entityId: user.id,
            changes: { event: 'password_reset_completed' },
          },
        });
      }

      return reply.send({ message: 'Password has been reset successfully.' });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: err.errors,
          },
        });
      }
      throw err;
    }
  });
};

export default routes;
