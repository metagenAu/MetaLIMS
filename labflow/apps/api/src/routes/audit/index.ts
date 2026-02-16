import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const AuditFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - Search audit log with filters
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const query = AuditFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, action, entityType, entityId, userId, dateFrom, dateTo } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { action: { contains: search, mode: 'insensitive' } },
          { entityType: { contains: search, mode: 'insensitive' } },
          { entityId: { contains: search, mode: 'insensitive' } },
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ];
      }
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (userId) where.userId = userId;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) (where.createdAt as Record<string, unknown>).gte = dateFrom;
        if (dateTo) (where.createdAt as Record<string, unknown>).lte = dateTo;
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      // Get distinct actions and entity types for filter dropdowns
      const [distinctActions, distinctEntityTypes] = await Promise.all([
        prisma.auditLog.findMany({
          where: { organizationId: request.user.organizationId },
          distinct: ['action'],
          select: { action: true },
          orderBy: { action: 'asc' },
        }),
        prisma.auditLog.findMany({
          where: { organizationId: request.user.organizationId },
          distinct: ['entityType'],
          select: { entityType: true },
          orderBy: { entityType: 'asc' },
        }),
      ]);

      return reply.send({
        data: logs,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        filters: {
          actions: distinctActions.map(a => a.action),
          entityTypes: distinctEntityTypes.map(e => e.entityType),
        },
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
};

export default routes;
