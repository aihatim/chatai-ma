import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient, Plan } from '@prisma/client';
import { z } from 'zod';

const PLANS = [
  { id: Plan.Starter, name: 'Starter', price: 49, whatsappConversations: 500, prospectingLeads: 200, features: ['1 Website Widget', '500 WhatsApp conversations/mo', '200 prospecting leads/mo', '1 Knowledge Base', '2 Team members', 'Basic analytics'] },
  { id: Plan.Pro, name: 'Pro', price: 149, whatsappConversations: 2000, prospectingLeads: 1000, features: ['3 Website Widgets', '2,000 WhatsApp conversations/mo', '1,000 prospecting leads/mo', '3 Knowledge Bases', '10 Team members', 'Advanced analytics', 'Custom branding', 'Priority support'] },
  { id: Plan.Business, name: 'Business', price: 399, whatsappConversations: 10000, prospectingLeads: 5000, features: ['10 Website Widgets', '10,000 WhatsApp conversations/mo', '5,000 prospecting leads/mo', '10 Knowledge Bases', 'Unlimited team members', 'Advanced analytics + exports', 'White-label', 'Dedicated account manager', 'API access', 'Custom integrations'] },
  { id: Plan.Enterprise, name: 'Enterprise', price: 0, whatsappConversations: 0, prospectingLeads: 0, features: ['Everything in Business', 'Custom limits', 'SLA guarantee', 'On-premise option', 'Dedicated infrastructure', '24/7 phone support', 'Custom AI model fine-tuning'] },
];

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'business', 'enterprise']).transform((p) => {
    const map: Record<string, Plan> = { starter: Plan.Starter, pro: Plan.Pro, business: Plan.Business, enterprise: Plan.Enterprise };
    return map[p];
  }),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export default async function (instance: FastifyInstance) {
  const prisma: PrismaClient = instance.prisma;
  const stripe = new (require('stripe') as any)(process.env.STRIPE_SECRET_KEY);

  instance.get('/plans', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return PLANS.map((plan) => ({
      ...plan,
      price: plan.price || 'Custom',
    }));
  });

  instance.post('/create-checkout', { preHandler: [instance.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message },
      });
    }

    const { plan, successUrl, cancelUrl } = parsed.data;
    const userId = request.user!.userId;
    const orgId = request.orgId;

    if (!orgId) {
      return reply.status(400).send({
        error: { code: 'NO_ORGANIZATION', message: 'No organization associated with user' },
      });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Organization not found' },
      });
    }

    if (plan === Plan.Enterprise) {
      return reply.status(400).send({
        error: { code: 'ENTERPRISE_REQUIRES_CONTACT', message: 'Please contact sales for Enterprise plans' },
      });
    }

    const selectedPlan = PLANS.find((p) => p.id === plan);
    if (!selectedPlan) {
      return reply.status(400).send({
        error: { code: 'INVALID_PLAN', message: 'Invalid plan selected' },
      });
    }

    const existingSubscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId, status: 'Active' },
    });

    if (existingSubscription?.stripeSubscriptionId) {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: process.env[`STRIPE_PRICE_${plan.toUpperCase()}`], quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: orgId,
        customer_email: request.user!.email,
        metadata: { orgId, plan, userId },
      });
      return { url: session.url, sessionId: session.id };
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env[`STRIPE_PRICE_${plan.toUpperCase()}`], quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orgId,
      customer_email: request.user!.email,
      metadata: { orgId, plan, userId },
    });

    return { url: session.url, sessionId: session.id };
  });

  instance.get('/portal', { preHandler: [instance.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId;
    if (!orgId) {
      return reply.status(400).send({
        error: { code: 'NO_ORGANIZATION', message: 'No organization associated' },
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return reply.status(404).send({
        error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription' },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeSubscriptionId,
      return_url: request.headers.referer || `${process.env.FRONTEND_URL}/billing`,
    });

    return { url: session.url };
  });

  instance.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers['stripe-signature'] as string;
    const rawBody = (request as any).rawBody;

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return reply.status(400).send({ error: { code: 'WEBHOOK_SIGNATURE_INVALID', message: 'Invalid signature' } });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { orgId, plan, userId } = session.metadata;
        const selectedPlan = PLANS.find((p) => p.id === plan);

        if (!selectedPlan) break;

        await prisma.subscription.upsert({
          where: { stripeSubscriptionId: session.subscription },
          update: {
            plan: selectedPlan.id,
            status: 'Active',
            currentPeriodStart: new Date(session.current_period_start * 1000),
            currentPeriodEnd: new Date(session.current_period_end * 1000),
            whatsappConversationsLimit: selectedPlan.whatsappConversations,
            prospectingLeadsLimit: selectedPlan.prospectingLeads,
            amountPerMonth: selectedPlan.price,
          },
          create: {
            organizationId: orgId,
            stripeSubscriptionId: session.subscription,
            plan: selectedPlan.id,
            status: 'Active',
            currentPeriodStart: new Date(session.current_period_start * 1000),
            currentPeriodEnd: new Date(session.current_period_end * 1000),
            whatsappConversationsLimit: selectedPlan.whatsappConversations,
            prospectingLeadsLimit: selectedPlan.prospectingLeads,
            amountPerMonth: selectedPlan.price,
          },
        });

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan: selectedPlan.id,
            maxWhatsappNumbers: selectedPlan.id === Plan.Starter ? 1 : selectedPlan.id === Plan.Pro ? 3 : 10,
            maxProspectingLeadsMonthly: selectedPlan.prospectingLeads,
            maxTeamMembers: selectedPlan.id === Plan.Starter ? 2 : selectedPlan.id === Plan.Pro ? 10 : 999,
            maxConcurrentCampaigns: selectedPlan.id === Plan.Starter ? 1 : selectedPlan.id === Plan.Pro ? 5 : 20,
            maxKnowledgeBases: selectedPlan.id === Plan.Starter ? 1 : selectedPlan.id === Plan.Pro ? 3 : 10,
          },
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;

        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: 'Active' },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const failedInvoice = event.data.object;
        const subId = failedInvoice.subscription;
        if (!subId) break;

        await prisma.subscription.update({
          where: { stripeSubscriptionId: subId },
          data: { status: 'PastDue' },
        });
        break;
      }

      case 'customer.subscription.updated': {
        const updatedSub = event.data.object;
        const planKey = updatedSub.items.data[0]?.price?.lookup_key || 'starter';
        const plan = PLANS.find((p) => p.id === planKey);

        await prisma.subscription.update({
          where: { stripeSubscriptionId: updatedSub.id },
          data: {
            status: updatedSub.status === 'active' ? 'Active' : updatedSub.status === 'past_due' ? 'PastDue' : 'Cancelled',
            currentPeriodStart: new Date(updatedSub.current_period_start * 1000),
            currentPeriodEnd: new Date(updatedSub.current_period_end * 1000),
            ...(plan && {
              plan: plan.id,
              amountPerMonth: plan.price,
              whatsappConversationsLimit: plan.whatsappConversations,
              prospectingLeadsLimit: plan.prospectingLeads,
            }),
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const deletedSub = event.data.object;
        const orgSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: deletedSub.id },
        });

        if (orgSub) {
          await prisma.subscription.update({
            where: { id: orgSub.id },
            data: { status: 'Cancelled' },
          });

          await prisma.organization.update({
            where: { id: orgSub.organizationId },
            data: { plan: 'Starter' },
          });
        }
        break;
      }
    }

    return reply.status(200).send({ received: true });
  });

  instance.get('/current', { preHandler: [instance.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId;
    if (!orgId) {
      return reply.status(400).send({
        error: { code: 'NO_ORGANIZATION', message: 'No organization associated' },
      });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    });

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });

    const periodStart = subscription?.currentPeriodStart || new Date();
    const usageStats = subscription
      ? {
          whatsappConversationsUsed: subscription.whatsappConversationsUsed,
          whatsappConversationsLimit: subscription.whatsappConversationsLimit,
          prospectingLeadsUsed: subscription.prospectingLeadsUsed,
          prospectingLeadsLimit: subscription.prospectingLeadsLimit,
        }
      : null;

    const conversationsThisPeriod = await prisma.conversation.count({
      where: { workspace: { organizationId: orgId }, createdAt: { gte: periodStart } },
    });

    return {
      plan: org?.plan || 'Starter',
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            amountPerMonth: Number(subscription.amountPerMonth),
          }
        : null,
      usage: {
        ...usageStats,
        totalConversationsThisPeriod: conversationsThisPeriod,
      },
    };
  });

  instance.post('/cancel', { preHandler: [instance.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const orgId = request.orgId;
    if (!orgId) {
      return reply.status(400).send({
        error: { code: 'NO_ORGANIZATION', message: 'No organization associated' },
      });
    }

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId, status: 'Active' },
    });

    if (!subscription) {
      return reply.status(404).send({
        error: { code: 'NO_ACTIVE_SUBSCRIPTION', message: 'No active subscription found' },
      });
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    return { message: 'Subscription will be cancelled at the end of the billing period' };
  });
}
