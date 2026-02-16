import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('lastName'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const UserFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  role: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  department: z.string().optional(),
});

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'ANALYST', 'REVIEWER', 'APPROVER', 'CLIENT_MANAGER', 'VIEWER']),
  title: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  qualifications: z.array(z.string()).optional(),
  signature: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['ADMIN', 'SUPERVISOR', 'ANALYST', 'REVIEWER', 'APPROVER', 'CLIENT_MANAGER', 'VIEWER']).optional(),
  title: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  qualifications: z.array(z.string()).optional(),
  signature: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
  password: z.string().min(8).max(128).optional(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List users
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const query = UserFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, role, isActive, department } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive;
      if (department) where.department = department;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            title: true,
            department: true,
            phone: true,
            qualifications: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                testsAssigned: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return reply.send({
        data: users,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST / - Create user
  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const body = CreateUserSchema.parse(request.body);

      // Check for duplicate email
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
      });

      if (existingUser) {
        return reply.status(409).send({
          error: { code: 'DUPLICATE', message: 'A user with this email already exists', details: null },
        });
      }

      const passwordHash = await bcrypt.hash(body.password, 12);
      const { password, ...userData } = body;

      const user = await prisma.user.create({
        data: {
          ...userData,
          email: body.email.toLowerCase(),
          passwordHash,
          organizationId: request.user.organizationId,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          title: true,
          department: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'User',
          entityId: user.id,
          details: { email: user.email, role: user.role, name: `${user.firstName} ${user.lastName}` },
        },
      });

      return reply.status(201).send({ data: user });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // PATCH /:id - Update user
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateUserSchema.parse(request.body);

      const existing = await prisma.user.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'User not found', details: null },
        });
      }

      // Check email uniqueness if changing
      if (body.email && body.email.toLowerCase() !== existing.email) {
        const duplicate = await prisma.user.findUnique({
          where: { email: body.email.toLowerCase() },
        });
        if (duplicate) {
          return reply.status(409).send({
            error: { code: 'DUPLICATE', message: 'A user with this email already exists', details: null },
          });
        }
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };

      // Handle password separately
      if (body.password) {
        updateData.passwordHash = await bcrypt.hash(body.password, 12);
      }

      // Copy other fields
      const { password, ...otherFields } = body;
      Object.assign(updateData, otherFields);
      if (body.email) {
        updateData.email = body.email.toLowerCase();
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          title: true,
          department: true,
          phone: true,
          qualifications: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Build audit detail without the password
      const auditChanges = { ...otherFields };
      if (body.password) {
        (auditChanges as Record<string, unknown>).passwordChanged = true;
      }

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'User',
          entityId: id,
          details: { changes: auditChanges },
        },
      });

      return reply.send({ data: user });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/deactivate - Deactivate user
  fastify.post('/:id/deactivate', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      reason: z.string().optional().nullable(),
    }).parse(request.body || {});

    if (id === request.user.id) {
      return reply.status(400).send({
        error: { code: 'SELF_DEACTIVATION', message: 'You cannot deactivate your own account', details: null },
      });
    }

    const existing = await prisma.user.findFirst({
      where: { id, organizationId: request.user.organizationId },
    });

    if (!existing) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User not found', details: null },
      });
    }

    if (!existing.isActive) {
      return reply.status(400).send({
        error: { code: 'ALREADY_DEACTIVATED', message: 'User is already deactivated', details: null },
      });
    }

    const user = await prisma.$transaction(async (tx) => {
      // Revoke all refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // Reassign pending tests to unassigned
      await tx.test.updateMany({
        where: {
          assignedToId: id,
          status: { in: ['PENDING'] },
        },
        data: { assignedToId: null },
      });

      return tx.user.update({
        where: { id },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedById: request.user.id,
          deactivationReason: body.reason,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        organizationId: request.user.organizationId,
        userId: request.user.id,
        action: 'DEACTIVATE',
        entityType: 'User',
        entityId: id,
        details: {
          email: existing.email,
          name: `${existing.firstName} ${existing.lastName}`,
          reason: body.reason,
        },
      },
    });

    return reply.send({ data: user });
  });
};

export default routes;
