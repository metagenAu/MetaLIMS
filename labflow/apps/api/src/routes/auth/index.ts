import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '@labflow/db';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

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
  password: z.string().min(8).max(128),
});

function generateAccessToken(payload: {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload: {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
}): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

const routes: FastifyPluginAsync = async (fastify) => {
  // POST /login
  fastify.post('/login', async (request, reply) => {
    try {
      const body = LoginSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
        include: { organization: true },
      });

      if (!user || !user.isActive) {
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
        return reply.status(401).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            details: null,
          },
        });
      }

      const tokenPayload = {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        email: user.email,
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

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
          details: { ip: request.ip },
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

      let decoded: jwt.JwtPayload;
      try {
        decoded = jwt.verify(body.refreshToken, JWT_REFRESH_SECRET) as jwt.JwtPayload;
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
        where: { id: decoded.userId },
      });

      if (!user || !user.isActive) {
        return reply.status(401).send({
          error: {
            code: 'USER_INACTIVE',
            message: 'User account is deactivated',
            details: null,
          },
        });
      }

      const tokenPayload = {
        userId: user.id,
        organizationId: user.organizationId,
        role: user.role,
        email: user.email,
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

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
        details: {},
      },
    });

    return reply.send({ message: 'Logged out successfully' });
  });

  // POST /forgot-password
  fastify.post('/forgot-password', async (request, reply) => {
    try {
      const body = ForgotPasswordSchema.parse(request.body);

      const user = await prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
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
        { userId: user.id, resetToken },
        'Password reset token generated (send via email in production)'
      );

      await prisma.auditLog.create({
        data: {
          organizationId: user.organizationId,
          userId: user.id,
          action: 'PASSWORD_RESET_REQUESTED',
          entityType: 'User',
          entityId: user.id,
          details: {},
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
            details: {},
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
