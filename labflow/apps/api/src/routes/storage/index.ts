import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const StorageFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  type: z.string().optional(),
  parentId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
});

const CreateStorageLocationSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  type: z.enum(['BUILDING', 'ROOM', 'FREEZER', 'REFRIGERATOR', 'SHELF', 'RACK', 'BOX', 'DRAWER', 'CABINET', 'OTHER']),
  parentId: z.string().uuid().optional().nullable(),
  description: z.string().optional().nullable(),
  temperatureMin: z.number().optional().nullable(),
  temperatureMax: z.number().optional().nullable(),
  temperatureUnit: z.enum(['CELSIUS', 'FAHRENHEIT']).default('CELSIUS'),
  humidityMin: z.number().optional().nullable(),
  humidityMax: z.number().optional().nullable(),
  capacity: z.number().int().optional().nullable(),
  barcode: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

const UpdateStorageLocationSchema = CreateStorageLocationSchema.partial();

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List storage locations
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = StorageFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, type, parentId, isActive } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (type) where.type = type;
      if (parentId !== undefined) where.parentId = parentId || null;
      if (isActive !== undefined) where.isActive = isActive;

      const [locations, total] = await Promise.all([
        prisma.storageLocation.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            parent: { select: { id: true, name: true, code: true } },
            _count: { select: { children: true, samples: true } },
          },
        }),
        prisma.storageLocation.count({ where }),
      ]);

      return reply.send({
        data: locations,
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

  // POST / - Create storage location
  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const body = CreateStorageLocationSchema.parse(request.body);

      // Check for duplicate code
      const existing = await prisma.storageLocation.findFirst({
        where: { code: body.code, organizationId: request.user.organizationId },
      });

      if (existing) {
        return reply.status(409).send({
          error: { code: 'DUPLICATE', message: 'A storage location with this code already exists', details: null },
        });
      }

      // Verify parent exists if specified
      let path = body.name;
      if (body.parentId) {
        const parent = await prisma.storageLocation.findFirst({
          where: { id: body.parentId, organizationId: request.user.organizationId },
        });
        if (!parent) {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'Parent storage location not found', details: null },
          });
        }
        path = `${parent.path} > ${body.name}`;
      }

      const location = await prisma.storageLocation.create({
        data: {
          ...body,
          path,
          organizationId: request.user.organizationId,
          createdById: request.user.id,
        },
        include: {
          parent: { select: { id: true, name: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'StorageLocation',
          entityId: location.id,
          details: { name: location.name, code: location.code, type: location.type },
        },
      });

      return reply.status(201).send({ data: location });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // PATCH /:id - Update storage location
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, fastify.requireRole('ADMIN')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateStorageLocationSchema.parse(request.body);

      const existing = await prisma.storageLocation.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Storage location not found', details: null },
        });
      }

      if (body.code && body.code !== existing.code) {
        const duplicate = await prisma.storageLocation.findFirst({
          where: { code: body.code, organizationId: request.user.organizationId, id: { not: id } },
        });
        if (duplicate) {
          return reply.status(409).send({
            error: { code: 'DUPLICATE', message: 'A storage location with this code already exists', details: null },
          });
        }
      }

      // Update path if name or parent changed
      const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
      if (body.name || body.parentId !== undefined) {
        const newName = body.name || existing.name;
        if (body.parentId) {
          const parent = await prisma.storageLocation.findFirst({
            where: { id: body.parentId, organizationId: request.user.organizationId },
          });
          if (parent) {
            updateData.path = `${parent.path} > ${newName}`;
          }
        } else if (body.parentId === null) {
          updateData.path = newName;
        } else if (body.name && existing.parentId) {
          const parent = await prisma.storageLocation.findUnique({
            where: { id: existing.parentId },
          });
          if (parent) {
            updateData.path = `${parent.path} > ${newName}`;
          }
        } else if (body.name) {
          updateData.path = newName;
        }
      }

      const location = await prisma.storageLocation.update({
        where: { id },
        data: updateData,
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { children: true, samples: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'StorageLocation',
          entityId: id,
          details: { changes: body },
        },
      });

      return reply.send({ data: location });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /:id/samples - List samples in a storage location
  fastify.get('/:id/samples', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const query = PaginationSchema.parse(request.query);
      const { page, pageSize, sort, order } = query;
      const skip = (page - 1) * pageSize;

      const location = await prisma.storageLocation.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!location) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Storage location not found', details: null },
        });
      }

      const [samples, total] = await Promise.all([
        prisma.sample.findMany({
          where: { storageLocationId: id, organizationId: request.user.organizationId },
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            order: { select: { id: true, orderNumber: true, client: { select: { id: true, name: true } } } },
          },
        }),
        prisma.sample.count({
          where: { storageLocationId: id, organizationId: request.user.organizationId },
        }),
      ]);

      return reply.send({
        data: samples,
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

  // GET /map - Get hierarchical storage map
  fastify.get('/map', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    // Get all storage locations and build a tree
    const locations = await prisma.storageLocation.findMany({
      where: {
        organizationId: request.user.organizationId,
        isActive: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { samples: true } },
      },
    });

    // Build tree structure
    type LocationNode = {
      id: string;
      name: string;
      code: string;
      type: string;
      path: string;
      capacity: number | null;
      sampleCount: number;
      temperatureMin: number | null;
      temperatureMax: number | null;
      children: LocationNode[];
    };

    const nodeMap = new Map<string, LocationNode>();
    const roots: LocationNode[] = [];

    // First pass: create nodes
    for (const loc of locations) {
      nodeMap.set(loc.id, {
        id: loc.id,
        name: loc.name,
        code: loc.code,
        type: loc.type,
        path: loc.path,
        capacity: loc.capacity,
        sampleCount: loc._count.samples,
        temperatureMin: loc.temperatureMin,
        temperatureMax: loc.temperatureMax,
        children: [],
      });
    }

    // Second pass: build tree
    for (const loc of locations) {
      const node = nodeMap.get(loc.id)!;
      if (loc.parentId && nodeMap.has(loc.parentId)) {
        nodeMap.get(loc.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return reply.send({ data: roots });
  });
};

export default routes;
