import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@labflow/db';

const DateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  period: z.enum(['day', 'week', 'month', 'quarter', 'year']).default('month'),
});

const routes: FastifyPluginAsync = async (fastify) => {
  // GET /kpis - Key Performance Indicators
  fastify.get('/kpis', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = DateRangeSchema.parse(request.query);
      const orgId = request.user.organizationId;

      const now = new Date();
      const periodStart = query.from || new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = query.to || now;

      const [
        totalOrders,
        completedOrders,
        totalSamples,
        totalTests,
        completedTests,
        activeClients,
        revenue,
        pendingInvoices,
      ] = await Promise.all([
        prisma.order.count({
          where: { organizationId: orgId, createdAt: { gte: periodStart, lte: periodEnd } },
        }),
        prisma.order.count({
          where: { organizationId: orgId, status: 'COMPLETED', createdAt: { gte: periodStart, lte: periodEnd } },
        }),
        prisma.sample.count({
          where: { organizationId: orgId, createdAt: { gte: periodStart, lte: periodEnd } },
        }),
        prisma.test.count({
          where: { organizationId: orgId, createdAt: { gte: periodStart, lte: periodEnd } },
        }),
        prisma.test.count({
          where: { organizationId: orgId, status: 'APPROVED', createdAt: { gte: periodStart, lte: periodEnd } },
        }),
        prisma.client.count({
          where: {
            organizationId: orgId,
            deletedAt: null,
            status: 'ACTIVE',
            orders: { some: { createdAt: { gte: periodStart, lte: periodEnd } } },
          },
        }),
        prisma.invoice.aggregate({
          where: {
            organizationId: orgId,
            status: 'PAID',
            paidAt: { gte: periodStart, lte: periodEnd },
          },
          _sum: { total: true },
        }),
        prisma.invoice.aggregate({
          where: {
            organizationId: orgId,
            status: { in: ['SENT', 'OVERDUE'] },
            amountDue: { gt: 0 },
          },
          _sum: { amountDue: true },
          _count: true,
        }),
      ]);

      return reply.send({
        data: {
          period: { from: periodStart, to: periodEnd },
          orders: {
            total: totalOrders,
            completed: completedOrders,
            completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
          },
          samples: {
            total: totalSamples,
          },
          tests: {
            total: totalTests,
            completed: completedTests,
            completionRate: totalTests > 0 ? (completedTests / totalTests) * 100 : 0,
          },
          clients: {
            active: activeClients,
          },
          financial: {
            revenue: revenue._sum.total || 0,
            pendingAmount: pendingInvoices._sum.amountDue || 0,
            pendingCount: pendingInvoices._count,
          },
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

  // GET /turnaround - Turnaround time analytics
  fastify.get('/turnaround', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = DateRangeSchema.parse(request.query);
      const orgId = request.user.organizationId;

      const now = new Date();
      const periodStart = query.from || new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const periodEnd = query.to || now;

      // Get completed orders with turnaround data
      const completedOrders = await prisma.order.findMany({
        where: {
          organizationId: orgId,
          status: { in: ['COMPLETED', 'REPORTED'] },
          completedAt: { gte: periodStart, lte: periodEnd },
          receivedAt: { not: null },
        },
        select: {
          id: true,
          orderNumber: true,
          receivedAt: true,
          completedAt: true,
          dueDate: true,
          priority: true,
          client: { select: { id: true, name: true } },
        },
      });

      const turnaroundData = completedOrders.map(order => {
        const receivedAt = order.receivedAt!;
        const completedAt = order.completedAt!;
        const turnaroundHours = (completedAt.getTime() - receivedAt.getTime()) / (1000 * 60 * 60);
        const turnaroundDays = turnaroundHours / 24;
        const onTime = order.dueDate ? completedAt <= order.dueDate : true;

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          clientName: order.client.name,
          priority: order.priority,
          turnaroundHours: Math.round(turnaroundHours * 10) / 10,
          turnaroundDays: Math.round(turnaroundDays * 10) / 10,
          onTime,
        };
      });

      const totalTurnaround = turnaroundData.reduce((sum, d) => sum + d.turnaroundDays, 0);
      const onTimeCount = turnaroundData.filter(d => d.onTime).length;

      return reply.send({
        data: {
          period: { from: periodStart, to: periodEnd },
          summary: {
            totalOrders: turnaroundData.length,
            averageTurnaroundDays: turnaroundData.length > 0 ? Math.round((totalTurnaround / turnaroundData.length) * 10) / 10 : 0,
            onTimePercentage: turnaroundData.length > 0 ? Math.round((onTimeCount / turnaroundData.length) * 1000) / 10 : 0,
            onTimeCount,
            lateCount: turnaroundData.length - onTimeCount,
          },
          orders: turnaroundData,
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

  // GET /volume - Sample and test volume over time
  fastify.get('/volume', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = DateRangeSchema.parse(request.query);
      const orgId = request.user.organizationId;

      const now = new Date();
      const periodStart = query.from || new Date(now.getFullYear(), now.getMonth() - 11, 1);
      const periodEnd = query.to || now;

      // Get monthly sample counts
      const samples = await prisma.sample.groupBy({
        by: ['createdAt'],
        where: {
          organizationId: orgId,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _count: true,
      });

      // Get monthly test counts
      const tests = await prisma.test.groupBy({
        by: ['createdAt'],
        where: {
          organizationId: orgId,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        _count: true,
      });

      // Aggregate by month
      const monthlyData: Record<string, { samples: number; tests: number; orders: number }> = {};

      const orders = await prisma.order.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        select: { createdAt: true },
      });

      for (const order of orders) {
        const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = { samples: 0, tests: 0, orders: 0 };
        monthlyData[key].orders++;
      }

      for (const sample of samples) {
        const key = `${sample.createdAt.getFullYear()}-${String(sample.createdAt.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = { samples: 0, tests: 0, orders: 0 };
        monthlyData[key].samples += sample._count;
      }

      for (const test of tests) {
        const key = `${test.createdAt.getFullYear()}-${String(test.createdAt.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyData[key]) monthlyData[key] = { samples: 0, tests: 0, orders: 0 };
        monthlyData[key].tests += test._count;
      }

      const sortedMonths = Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data }));

      return reply.send({
        data: {
          period: { from: periodStart, to: periodEnd },
          monthly: sortedMonths,
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

  // GET /revenue - Revenue analytics
  fastify.get('/revenue', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    try {
      const query = DateRangeSchema.parse(request.query);
      const orgId = request.user.organizationId;

      const now = new Date();
      const periodStart = query.from || new Date(now.getFullYear(), 0, 1);
      const periodEnd = query.to || now;

      const [invoiced, collected, outstanding, topClients] = await Promise.all([
        prisma.invoice.aggregate({
          where: {
            organizationId: orgId,
            createdAt: { gte: periodStart, lte: periodEnd },
            status: { notIn: ['VOID', 'DRAFT'] },
          },
          _sum: { total: true },
          _count: true,
        }),
        prisma.payment.aggregate({
          where: {
            organizationId: orgId,
            status: 'COMPLETED',
            paymentDate: { gte: periodStart, lte: periodEnd },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: {
            organizationId: orgId,
            status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
            amountDue: { gt: 0 },
          },
          _sum: { amountDue: true },
        }),
        prisma.invoice.groupBy({
          by: ['clientId'],
          where: {
            organizationId: orgId,
            status: 'PAID',
            paidAt: { gte: periodStart, lte: periodEnd },
          },
          _sum: { total: true },
          orderBy: { _sum: { total: 'desc' } },
          take: 10,
        }),
      ]);

      // Enrich top clients with names
      const clientIds = topClients.map(tc => tc.clientId);
      const clients = await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, name: true, code: true },
      });
      const clientMap = new Map(clients.map(c => [c.id, c]));

      const topClientsEnriched = topClients.map(tc => ({
        clientId: tc.clientId,
        clientName: clientMap.get(tc.clientId)?.name || 'Unknown',
        clientCode: clientMap.get(tc.clientId)?.code || '',
        revenue: tc._sum.total || 0,
      }));

      return reply.send({
        data: {
          period: { from: periodStart, to: periodEnd },
          summary: {
            invoiced: invoiced._sum.total || 0,
            invoiceCount: invoiced._count,
            collected: collected._sum.amount || 0,
            paymentCount: collected._count,
            outstanding: outstanding._sum.amountDue || 0,
            collectionRate: (invoiced._sum.total || 0) > 0
              ? ((collected._sum.amount || 0) / (invoiced._sum.total || 1)) * 100
              : 0,
          },
          topClients: topClientsEnriched,
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

  // GET /pending-actions - Items requiring user action
  fastify.get('/pending-actions', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const orgId = request.user.organizationId;
    const userId = request.user.id;

    const [
      pendingTests,
      testsNeedingReview,
      testsNeedingApproval,
      overdueTests,
      ordersToReceive,
      reportsPendingApproval,
      invoicesPendingApproval,
      overdueInvoices,
      instrumentsDueCalibration,
    ] = await Promise.all([
      prisma.test.count({
        where: { organizationId: orgId, assignedToId: userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      }),
      prisma.test.count({
        where: { organizationId: orgId, status: { in: ['COMPLETED', 'PENDING_REVIEW'] } },
      }),
      prisma.test.count({
        where: { organizationId: orgId, status: 'REVIEWED' },
      }),
      prisma.test.count({
        where: {
          organizationId: orgId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { lt: new Date() },
        },
      }),
      prisma.order.count({
        where: { organizationId: orgId, status: 'SUBMITTED' },
      }),
      prisma.report.count({
        where: { organizationId: orgId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
      }),
      prisma.invoice.count({
        where: { organizationId: orgId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
      }),
      prisma.invoice.count({
        where: {
          organizationId: orgId,
          status: { in: ['SENT', 'PARTIALLY_PAID'] },
          dueDate: { lt: new Date() },
          amountDue: { gt: 0 },
        },
      }),
      prisma.instrument.count({
        where: {
          organizationId: orgId,
          status: 'ACTIVE',
          nextCalibrationDate: { lte: new Date() },
        },
      }),
    ]);

    return reply.send({
      data: {
        myPendingTests: pendingTests,
        testsNeedingReview,
        testsNeedingApproval,
        overdueTests,
        ordersToReceive,
        reportsPendingApproval,
        invoicesPendingApproval,
        overdueInvoices,
        instrumentsDueCalibration,
        totalActionItems:
          pendingTests + testsNeedingReview + testsNeedingApproval +
          ordersToReceive + reportsPendingApproval + invoicesPendingApproval +
          instrumentsDueCalibration,
      },
    });
  });

  // GET /analyst-workload - Workload distribution across analysts
  fastify.get('/analyst-workload', {
    preHandler: [fastify.authenticate, fastify.requireRole('SUPERVISOR')],
  }, async (request, reply) => {
    const orgId = request.user.organizationId;

    const analysts = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        role: { in: ['ANALYST', 'REVIEWER', 'SUPERVISOR'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
      },
    });

    const workload = await Promise.all(
      analysts.map(async (analyst) => {
        const [pending, inProgress, completedToday, completedThisWeek] = await Promise.all([
          prisma.test.count({
            where: { assignedToId: analyst.id, status: 'PENDING', organizationId: orgId },
          }),
          prisma.test.count({
            where: { assignedToId: analyst.id, status: 'IN_PROGRESS', organizationId: orgId },
          }),
          prisma.test.count({
            where: {
              assignedToId: analyst.id,
              status: { in: ['COMPLETED', 'REVIEWED', 'APPROVED'] },
              completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
              organizationId: orgId,
            },
          }),
          prisma.test.count({
            where: {
              assignedToId: analyst.id,
              status: { in: ['COMPLETED', 'REVIEWED', 'APPROVED'] },
              completedAt: {
                gte: new Date(new Date().setDate(new Date().getDate() - new Date().getDay())),
              },
              organizationId: orgId,
            },
          }),
        ]);

        return {
          analyst: {
            id: analyst.id,
            name: `${analyst.firstName} ${analyst.lastName}`,
            role: analyst.role,
            department: analyst.department,
          },
          pending,
          inProgress,
          totalActive: pending + inProgress,
          completedToday,
          completedThisWeek,
        };
      })
    );

    // Sort by total active tests descending
    workload.sort((a, b) => b.totalActive - a.totalActive);

    return reply.send({ data: workload });
  });
};

export default routes;
