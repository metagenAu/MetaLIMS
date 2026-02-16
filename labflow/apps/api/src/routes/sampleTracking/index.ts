/**
 * Sample Tracking Dashboard Routes
 *
 * Provides endpoints for the sample tracking pipeline view, TAT KPIs,
 * and batch overview.  These complement the existing /dashboard routes
 * with workflow-stage-aware tracking.
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';
import { getCategoryLabel } from '@labflow/shared';

// ------------------------------------------------------------------
// Shared query schemas
// ------------------------------------------------------------------

const TrackingQuerySchema = z.object({
  category: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // ================================================================
  // GET /pipeline - Sample counts by stage, grouped by category
  // ================================================================
  fastify.get(
    '/pipeline',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const query = TrackingQuerySchema.parse(request.query);
        const orgId = request.user.organizationId;

        // 1. Fetch active stage definitions (optionally filtered by category)
        const stageWhere: Record<string, unknown> = {
          organizationId: orgId,
          isActive: true,
        };
        if (query.category) stageWhere.category = query.category;

        const stages = await prisma.workflowStageDefinition.findMany({
          where: stageWhere,
          orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
        });

        if (stages.length === 0) {
          return reply.send({ data: { categories: [] } });
        }

        // 2. For each stage, count samples currently AT that stage
        //    (i.e. the latest stage log entry with no exitedAt).
        const stageCounts = await prisma.sampleStageLog.groupBy({
          by: ['stageDefinitionId', 'category', 'stageKey'],
          where: {
            organizationId: orgId,
            exitedAt: null, // still at this stage
            ...(query.category ? { category: query.category } : {}),
          },
          _count: { sampleId: true },
        });

        const countMap = new Map<string, number>();
        for (const row of stageCounts) {
          countMap.set(row.stageDefinitionId, row._count.sampleId);
        }

        // 3. Group stages by category
        const categoryMap = new Map<
          string,
          {
            category: string;
            categoryLabel: string;
            stages: {
              stageKey: string;
              label: string;
              color: string;
              sortOrder: number;
              sampleCount: number;
              expectedDurationHours: number | null;
            }[];
            totalSamples: number;
          }
        >();

        for (const stage of stages) {
          let cat = categoryMap.get(stage.category);
          if (!cat) {
            cat = {
              category: stage.category,
              categoryLabel: getCategoryLabel(stage.category),
              stages: [],
              totalSamples: 0,
            };
            categoryMap.set(stage.category, cat);
          }
          const count = countMap.get(stage.id) ?? 0;
          cat.stages.push({
            stageKey: stage.stageKey,
            label: stage.label,
            color: stage.color ?? '#6B7280',
            sortOrder: stage.sortOrder,
            sampleCount: count,
            expectedDurationHours: stage.expectedDurationHours,
          });
          cat.totalSamples += count;
        }

        return reply.send({
          data: {
            categories: Array.from(categoryMap.values()),
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: err.errors,
            },
          });
        }
        throw err;
      }
    },
  );

  // ================================================================
  // GET /tat - Turn-Around-Time metrics by category and stage
  // ================================================================
  fastify.get(
    '/tat',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const query = TrackingQuerySchema.parse(request.query);
        const orgId = request.user.organizationId;

        const now = new Date();
        const periodStart =
          query.from ?? new Date(now.getFullYear(), now.getMonth() - 3, 1);
        const periodEnd = query.to ?? now;

        // Fetch completed stage logs within the period
        const logs = await prisma.sampleStageLog.findMany({
          where: {
            organizationId: orgId,
            exitedAt: { not: null },
            enteredAt: { gte: periodStart, lte: periodEnd },
            ...(query.category ? { category: query.category } : {}),
          },
          select: {
            category: true,
            stageKey: true,
            durationMinutes: true,
            stageDefinition: {
              select: {
                label: true,
                expectedDurationHours: true,
              },
            },
          },
        });

        // Group by category → stageKey
        type StageAgg = {
          label: string;
          durations: number[];
          expectedMinutes: number | null;
        };

        const catMap = new Map<string, Map<string, StageAgg>>();

        for (const log of logs) {
          if (log.durationMinutes == null) continue;

          let stageMap = catMap.get(log.category);
          if (!stageMap) {
            stageMap = new Map();
            catMap.set(log.category, stageMap);
          }

          let agg = stageMap.get(log.stageKey);
          if (!agg) {
            agg = {
              label: log.stageDefinition.label,
              durations: [],
              expectedMinutes: log.stageDefinition.expectedDurationHours
                ? log.stageDefinition.expectedDurationHours * 60
                : null,
            };
            stageMap.set(log.stageKey, agg);
          }

          agg.durations.push(log.durationMinutes);
        }

        // Compute metrics
        const categories = Array.from(catMap.entries()).map(
          ([category, stageMap]) => {
            let totalDuration = 0;
            let totalCount = 0;
            let onTimeCount = 0;

            const stages = Array.from(stageMap.entries()).map(
              ([stageKey, agg]) => {
                const sorted = [...agg.durations].sort((a, b) => a - b);
                const count = sorted.length;
                const avg =
                  count > 0
                    ? Math.round(
                        sorted.reduce((s, v) => s + v, 0) / count,
                      )
                    : 0;
                const median =
                  count > 0
                    ? sorted[Math.floor(count / 2)]
                    : 0;
                const p95 =
                  count > 0
                    ? sorted[Math.floor(count * 0.95)]
                    : 0;

                const onTarget =
                  agg.expectedMinutes != null
                    ? sorted.filter((d) => d <= agg.expectedMinutes!).length
                    : count;

                totalDuration += sorted.reduce((s, v) => s + v, 0);
                totalCount += count;
                onTimeCount += onTarget;

                return {
                  stageKey,
                  label: agg.label,
                  avgDurationMinutes: avg,
                  medianDurationMinutes: median,
                  p95DurationMinutes: p95,
                  expectedDurationMinutes: agg.expectedMinutes,
                  sampleCount: count,
                  onTargetPercentage:
                    count > 0
                      ? Math.round((onTarget / count) * 1000) / 10
                      : 100,
                };
              },
            );

            return {
              category,
              categoryLabel: getCategoryLabel(category),
              stages,
              overallAvgDays:
                totalCount > 0
                  ? Math.round((totalDuration / totalCount / 60 / 24) * 10) /
                    10
                  : 0,
              overallOnTimePercentage:
                totalCount > 0
                  ? Math.round((onTimeCount / totalCount) * 1000) / 10
                  : 100,
            };
          },
        );

        return reply.send({
          data: {
            period: { from: periodStart, to: periodEnd },
            categories,
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: err.errors,
            },
          });
        }
        throw err;
      }
    },
  );

  // ================================================================
  // GET /batches - Batch overview for dashboard
  // ================================================================
  fastify.get(
    '/batches',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const query = z
          .object({
            category: z.string().optional(),
            status: z.string().optional(),
            page: z.coerce.number().int().min(1).default(1),
            pageSize: z.coerce.number().int().min(1).max(100).default(20),
          })
          .parse(request.query);

        const orgId = request.user.organizationId;

        const where: Record<string, unknown> = { organizationId: orgId };
        if (query.category) where.category = query.category;
        if (query.status) where.status = query.status;

        const [batches, total] = await Promise.all([
          prisma.analysisBatch.findMany({
            where,
            orderBy: { openedAt: 'desc' },
            skip: (query.page - 1) * query.pageSize,
            take: query.pageSize,
            include: {
              items: {
                select: {
                  id: true,
                  status: true,
                  isRerun: true,
                },
              },
              sequencingRun: {
                select: { runIdentifier: true },
              },
            },
          }),
          prisma.analysisBatch.count({ where }),
        ]);

        const data = batches.map((batch) => {
          const items = batch.items;
          const completedCount = items.filter(
            (i) => i.status === 'COMPLETED',
          ).length;
          const failedCount = items.filter(
            (i) => i.status === 'FAILED',
          ).length;
          const rerunCount = items.filter((i) => i.isRerun).length;

          return {
            id: batch.id,
            batchNumber: batch.batchNumber,
            category: batch.category,
            status: batch.status,
            itemCount: items.length,
            completedCount,
            failedCount,
            rerunCount,
            progressPercent:
              items.length > 0
                ? Math.round((completedCount / items.length) * 100)
                : 0,
            openedAt: batch.openedAt.toISOString(),
            dueDate: batch.dueDate?.toISOString() ?? null,
            sequencingRunIdentifier:
              batch.sequencingRun?.runIdentifier ?? null,
          };
        });

        return reply.send({
          data,
          pagination: {
            page: query.page,
            pageSize: query.pageSize,
            total,
            totalPages: Math.ceil(total / query.pageSize),
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: err.errors,
            },
          });
        }
        throw err;
      }
    },
  );

  // ================================================================
  // GET /summary - High-level tracking summary for KPI cards
  // ================================================================
  fastify.get(
    '/summary',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const orgId = request.user.organizationId;

      const [
        activeSamples,
        samplesInProgress,
        openBatches,
        completedBatchesThisMonth,
        overdueItems,
        rerunCount,
      ] = await Promise.all([
        // Samples currently at any non-terminal stage
        prisma.sampleStageLog.groupBy({
          by: ['sampleId'],
          where: {
            organizationId: orgId,
            exitedAt: null,
          },
          _count: true,
        }).then((r) => r.length),

        // Samples at stages that indicate active processing
        prisma.sampleStageLog.count({
          where: {
            organizationId: orgId,
            exitedAt: null,
            stageKey: {
              in: [
                'WEIGHING',
                'DNA_EXTRACTION',
                'PCR',
                'POOLING',
                'SEQUENCING',
                'BIOINFORMATICS',
                'SAMPLE_PREP',
                'ANALYSIS',
              ],
            },
          },
        }),

        // Open batches
        prisma.analysisBatch.count({
          where: {
            organizationId: orgId,
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
        }),

        // Completed batches this month
        prisma.analysisBatch.count({
          where: {
            organizationId: orgId,
            status: 'COMPLETED',
            closedAt: {
              gte: new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                1,
              ),
            },
          },
        }),

        // Batch items past due date
        prisma.analysisBatchItem.count({
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
            batch: {
              organizationId: orgId,
              dueDate: { lt: new Date() },
            },
          },
        }),

        // Total re-run items
        prisma.analysisBatchItem.count({
          where: {
            isRerun: true,
            batch: {
              organizationId: orgId,
              openedAt: {
                gte: new Date(
                  new Date().getFullYear(),
                  new Date().getMonth(),
                  1,
                ),
              },
            },
          },
        }),
      ]);

      return reply.send({
        data: {
          activeSamples,
          samplesInProgress,
          openBatches,
          completedBatchesThisMonth,
          overdueItems,
          rerunCount,
        },
      });
    },
  );

  // ================================================================
  // POST /transition - Move a sample to a new stage
  // ================================================================
  fastify.post(
    '/transition',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      try {
        const body = z
          .object({
            sampleId: z.string().uuid(),
            stageDefinitionId: z.string().uuid(),
            testId: z.string().uuid().optional(),
            batchId: z.string().uuid().optional(),
            notes: z.string().optional(),
          })
          .parse(request.body);

        const orgId = request.user.organizationId;
        const userId = request.user.id;

        // Validate the stage definition
        const stageDef =
          await prisma.workflowStageDefinition.findUnique({
            where: { id: body.stageDefinitionId },
          });

        if (!stageDef || stageDef.organizationId !== orgId) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Workflow stage definition not found',
            },
          });
        }

        // Close any currently-open stage log for this sample in the same category
        const openLog = await prisma.sampleStageLog.findFirst({
          where: {
            sampleId: body.sampleId,
            category: stageDef.category,
            exitedAt: null,
          },
          orderBy: { enteredAt: 'desc' },
        });

        const now = new Date();

        if (openLog) {
          const durationMs = now.getTime() - openLog.enteredAt.getTime();
          const durationMinutes = Math.round(durationMs / 60000);

          await prisma.sampleStageLog.update({
            where: { id: openLog.id },
            data: {
              exitedAt: now,
              durationMinutes,
            },
          });
        }

        // Create the new stage log
        const newLog = await prisma.sampleStageLog.create({
          data: {
            organizationId: orgId,
            sampleId: body.sampleId,
            testId: body.testId,
            batchId: body.batchId,
            stageDefinitionId: body.stageDefinitionId,
            category: stageDef.category,
            stageKey: stageDef.stageKey,
            enteredAt: now,
            performedById: userId,
            notes: body.notes,
          },
        });

        return reply.status(201).send({ data: newLog });
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
    },
  );

  // ================================================================
  // GET /stages - List workflow stage definitions for org
  // ================================================================
  fastify.get(
    '/stages',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = z
        .object({
          category: z.string().optional(),
          activeOnly: z.coerce.boolean().default(true),
        })
        .parse(request.query);

      const orgId = request.user.organizationId;

      const where: Record<string, unknown> = { organizationId: orgId };
      if (query.category) where.category = query.category;
      if (query.activeOnly) where.isActive = true;

      const stages = await prisma.workflowStageDefinition.findMany({
        where,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      });

      return reply.send({ data: stages });
    },
  );

  // ================================================================
  // POST /stages/seed - Seed default stages for a category
  // ================================================================
  fastify.post(
    '/stages/seed',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole('LAB_MANAGER'),
      ],
    },
    async (request, reply) => {
      try {
        const body = z
          .object({
            category: z.string(),
          })
          .parse(request.body);

        const orgId = request.user.organizationId;

        // Import default stages for this category
        const { getDefaultStages } = await import('@labflow/shared');
        const defaults = getDefaultStages(body.category);

        // Check if stages already exist for this category
        const existingCount =
          await prisma.workflowStageDefinition.count({
            where: {
              organizationId: orgId,
              category: body.category,
            },
          });

        if (existingCount > 0) {
          return reply.status(409).send({
            error: {
              code: 'CONFLICT',
              message: `Workflow stages already exist for category ${body.category}. Delete existing stages first or manage them individually.`,
            },
          });
        }

        const created = await prisma.$transaction(
          defaults.map((stage, index) =>
            prisma.workflowStageDefinition.create({
              data: {
                organizationId: orgId,
                category: body.category,
                stageKey: stage.stageKey,
                label: stage.label,
                description: stage.description,
                sortOrder: index,
                color: stage.color,
                isTerminal: stage.isTerminal,
                expectedDurationHours: stage.expectedDurationHours,
              },
            }),
          ),
        );

        return reply.status(201).send({ data: created });
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
    },
  );
};

export default routes;
