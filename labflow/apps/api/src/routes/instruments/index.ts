import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const InstrumentFilterSchema = PaginationSchema.extend({
  search: z.string().optional(),
  type: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED']).optional(),
  locationId: z.string().uuid().optional(),
});

const CreateInstrumentSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  type: z.string().optional().nullable(),
  manufacturer: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  assetTag: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED']).default('ACTIVE'),
  locationId: z.string().uuid().optional().nullable(),
  purchaseDate: z.coerce.date().optional().nullable(),
  warrantyExpiration: z.coerce.date().optional().nullable(),
  lastCalibrationDate: z.coerce.date().optional().nullable(),
  nextCalibrationDate: z.coerce.date().optional().nullable(),
  calibrationInterval: z.number().int().optional().nullable(), // in days
  calibrationProcedure: z.string().optional().nullable(),
  maintenanceSchedule: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  specifications: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateInstrumentSchema = CreateInstrumentSchema.partial();

const CalibrateSchema = z.object({
  calibrationDate: z.coerce.date().default(() => new Date()),
  calibratedById: z.string().uuid().optional(),
  certificateNumber: z.string().optional().nullable(),
  certificateUrl: z.string().url().optional().nullable(),
  result: z.enum(['PASS', 'FAIL', 'CONDITIONAL']),
  nextCalibrationDate: z.coerce.date().optional().nullable(),
  temperature: z.number().optional().nullable(),
  humidity: z.number().optional().nullable(),
  standards: z.array(z.object({
    name: z.string(),
    value: z.string(),
    traceability: z.string().optional(),
  })).optional(),
  measurements: z.array(z.object({
    parameter: z.string(),
    expected: z.number(),
    measured: z.number(),
    tolerance: z.number().optional(),
    pass: z.boolean(),
  })).optional(),
  notes: z.string().optional().nullable(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET / - List instruments
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = InstrumentFilterSchema.parse(request.query);
      const { page, pageSize, sort, order, search, type, status, locationId } = query;
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
          { manufacturer: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (type) where.type = type;
      if (status) where.status = status;
      if (locationId) where.locationId = locationId;

      const [instruments, total] = await Promise.all([
        prisma.instrument.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sort]: order },
          include: {
            location: { select: { id: true, name: true, path: true } },
            _count: { select: { calibrations: true, tests: true } },
          },
        }),
        prisma.instrument.count({ where }),
      ]);

      return reply.send({
        data: instruments,
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

  // POST / - Create instrument
  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.requireRole('LAB_MANAGER')],
  }, async (request, reply) => {
    try {
      const body = CreateInstrumentSchema.parse(request.body);

      const existing = await prisma.instrument.findFirst({
        where: { code: body.code, organizationId: request.user.organizationId },
      });

      if (existing) {
        return reply.status(409).send({
          error: { code: 'DUPLICATE', message: 'An instrument with this code already exists', details: null },
        });
      }

      const instrument = await prisma.instrument.create({
        data: {
          ...body,
          organizationId: request.user.organizationId,
          createdById: request.user.id,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CREATE',
          entityType: 'Instrument',
          entityId: instrument.id,
          details: { name: instrument.name, code: instrument.code },
        },
      });

      return reply.status(201).send({ data: instrument });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // PATCH /:id - Update instrument
  fastify.patch('/:id', {
    preHandler: [fastify.authenticate, fastify.requireRole('LAB_MANAGER')],
  }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = UpdateInstrumentSchema.parse(request.body);

      const existing = await prisma.instrument.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Instrument not found', details: null },
        });
      }

      if (body.code && body.code !== existing.code) {
        const duplicate = await prisma.instrument.findFirst({
          where: { code: body.code, organizationId: request.user.organizationId, id: { not: id } },
        });
        if (duplicate) {
          return reply.status(409).send({
            error: { code: 'DUPLICATE', message: 'An instrument with this code already exists', details: null },
          });
        }
      }

      const instrument = await prisma.instrument.update({
        where: { id },
        data: { ...body, updatedAt: new Date() },
        include: {
          location: { select: { id: true, name: true, path: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'UPDATE',
          entityType: 'Instrument',
          entityId: id,
          details: { changes: body },
        },
      });

      return reply.send({ data: instrument });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // POST /:id/calibrate - Record calibration
  fastify.post('/:id/calibrate', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = CalibrateSchema.parse(request.body);

      const instrument = await prisma.instrument.findFirst({
        where: { id, organizationId: request.user.organizationId },
      });

      if (!instrument) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Instrument not found', details: null },
        });
      }

      const nextCalDate = body.nextCalibrationDate ||
        (instrument.calibrationInterval
          ? new Date(body.calibrationDate.getTime() + instrument.calibrationInterval * 24 * 60 * 60 * 1000)
          : null);

      const calibration = await prisma.$transaction(async (tx) => {
        const cal = await tx.instrumentCalibration.create({
          data: {
            instrumentId: id,
            calibrationDate: body.calibrationDate,
            calibratedById: body.calibratedById || request.user.id,
            certificateNumber: body.certificateNumber,
            certificateUrl: body.certificateUrl,
            result: body.result,
            nextCalibrationDate: nextCalDate,
            temperature: body.temperature,
            humidity: body.humidity,
            standards: body.standards || [],
            measurements: body.measurements || [],
            notes: body.notes,
          },
        });

        // Update instrument with latest calibration info
        const updateData: Record<string, unknown> = {
          lastCalibrationDate: body.calibrationDate,
          nextCalibrationDate: nextCalDate,
          updatedAt: new Date(),
        };

        if (body.result === 'FAIL') {
          updateData.status = 'OUT_OF_SERVICE';
        }

        await tx.instrument.update({
          where: { id },
          data: updateData,
        });

        return cal;
      });

      await prisma.auditLog.create({
        data: {
          organizationId: request.user.organizationId,
          userId: request.user.id,
          action: 'CALIBRATE',
          entityType: 'Instrument',
          entityId: id,
          details: {
            calibrationId: calibration.id,
            result: body.result,
            certificateNumber: body.certificateNumber,
          },
        },
      });

      return reply.status(201).send({ data: calibration });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
        });
      }
      throw err;
    }
  });

  // GET /due-calibration - Get instruments due for calibration
  fastify.get('/due-calibration', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = z.object({
        daysAhead: z.coerce.number().int().min(0).default(30),
        includeOverdue: z.coerce.boolean().default(true),
      }).parse(request.query);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + query.daysAhead);

      const where: Record<string, unknown> = {
        organizationId: request.user.organizationId,
        status: { in: ['ACTIVE', 'MAINTENANCE'] },
      };

      if (query.includeOverdue) {
        where.OR = [
          { nextCalibrationDate: { lte: futureDate } },
          { nextCalibrationDate: null, calibrationInterval: { not: null } },
        ];
      } else {
        where.nextCalibrationDate = {
          gte: new Date(),
          lte: futureDate,
        };
      }

      const instruments = await prisma.instrument.findMany({
        where,
        orderBy: { nextCalibrationDate: 'asc' },
        include: {
          location: { select: { id: true, name: true } },
          calibrations: {
            orderBy: { calibrationDate: 'desc' },
            take: 1,
            select: {
              id: true,
              calibrationDate: true,
              result: true,
              certificateNumber: true,
            },
          },
        },
      });

      const categorized = {
        overdue: instruments.filter(i =>
          i.nextCalibrationDate && i.nextCalibrationDate < new Date()
        ),
        dueSoon: instruments.filter(i =>
          i.nextCalibrationDate && i.nextCalibrationDate >= new Date() && i.nextCalibrationDate <= futureDate
        ),
        neverCalibrated: instruments.filter(i =>
          !i.nextCalibrationDate && i.calibrationInterval
        ),
      };

      return reply.send({ data: categorized });
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
