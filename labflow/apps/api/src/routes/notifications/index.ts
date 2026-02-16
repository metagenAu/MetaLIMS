import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const NotificationFilterSchema = PaginationSchema.extend({
  isRead: z.coerce.boolean().optional(),
  type: z.string().optional(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List notifications for the current user
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = NotificationFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, isRead, type } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        userId: request.user.id,
        organizationId: request.user.organizationId,
      };

      if (isRead !== undefined) where.isRead = isRead;
      if (type) where.type = type;

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: {
            userId: request.user.id,
            organizationId: request.user.organizationId,
            isRead: false,
          },
        }),
      ]);

      return reply.send({
        data: notifications,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
        unreadCount,
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

  // PATCH /:id/read - Mark a notification as read
  fastify.patch('/:id/read', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: request.user.id,
        organizationId: request.user.organizationId,
      },
    });

    if (!notification) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Notification not found', details: null },
      });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return reply.send({ data: updated });
  });

  // POST /read-all - Mark all notifications as read
  fastify.post('/read-all', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const result = await prisma.notification.updateMany({
      where: {
        userId: request.user.id,
        organizationId: request.user.organizationId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return reply.send({
      data: {
        markedRead: result.count,
        message: `${result.count} notification(s) marked as read`,
      },
    });
  });
};

export default routes;
