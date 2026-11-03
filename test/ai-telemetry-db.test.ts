import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { recordAiExecution, generateCorrelationId } from '@/lib/observability/telemetry';

const TEST_PREFIX = 'PHASE3_TEST_';

describe('Phase 3 — AI Telemetry Live Database Verification', () => {
  let testLeadId: string;
  let testUserId: string;

  beforeAll(async () => {
    // 1. Create temporary test user
    const user = await prisma.user.create({
      data: {
        email: `${TEST_PREFIX}user_${Date.now()}@leadpilot.ai`,
        name: `${TEST_PREFIX}Telemetry User`,
        passwordHash: 'dummy_hash_for_test',
      },
    });
    testUserId = user.id;

    // 2. Create temporary test lead
    const lead = await prisma.lead.create({
      data: {
        userId: testUserId,
        name: `${TEST_PREFIX}Telemetry Lead`,
        location: 'Whitefield, Bengaluru',
        propertyRequirement: '3 BHK Apartment',
        budgetInr: 15000000,
        buyingTimeline: '0-3 months',
        customerMessage: 'Looking for a 3BHK flat near ITPL.',
      },
    });
    testLeadId = lead.id;
  }, 30000);

  afterAll(async () => {
    // Clean up temporary test data
    await prisma.aiExecutionLog.deleteMany({
      where: { lead: { name: { startsWith: TEST_PREFIX } } },
    });
    await prisma.lead.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    await prisma.user.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    });
  }, 30000);

  it('persists AI execution telemetry to PostgreSQL and retrieves it with correct types', async () => {
    const correlationId = generateCorrelationId();

    const created = await recordAiExecution({
      correlationId,
      leadId: testLeadId,
      userId: testUserId,
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'v1.1.0',
      status: 'SUCCESS',
      latencyMs: 385,
      attempts: 1,
      retryCount: 0,
      quality: {
        intentLevel: 'HIGH',
        engagementLevel: 'HIGH',
        requirementClarity: 'CLEAR',
        uncertainFields: [],
        keyRequirementsCount: 2,
        objectionsCount: 1,
        suggestedQuestionsCount: 3,
      },
      tokens: {
        promptTokens: 310,
        responseTokens: 140,
        totalTokens: 450,
      },
    });

    expect(created).not.toBeNull();
    expect(created?.correlationId).toBe(correlationId);

    // Query back from PostgreSQL
    const found = await prisma.aiExecutionLog.findUnique({
      where: { correlationId },
    });

    expect(found).not.toBeNull();
    expect(found?.leadId).toBe(testLeadId);
    expect(found?.userId).toBe(testUserId);
    expect(found?.model).toBe('gemini-3.5-flash-lite');
    expect(found?.promptVersion).toBe('v1.1.0');
    expect(found?.status).toBe('SUCCESS');
    expect(found?.latencyMs).toBe(385);
    expect(found?.promptTokens).toBe(310);
    expect(found?.responseTokens).toBe(140);
    expect(found?.totalTokens).toBe(450);
    expect(found?.intentLevel).toBe('HIGH');
    expect(found?.uncertainFields).toEqual([]);
    expect(found?.keyRequirementsCount).toBe(2);
  }, 30000);

  it('persists FAILED telemetry with sanitized error classification', async () => {
    const correlationId = generateCorrelationId();

    const created = await recordAiExecution({
      correlationId,
      leadId: testLeadId,
      userId: testUserId,
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'v1.1.0',
      status: 'FAILED',
      latencyMs: 15000,
      attempts: 2,
      retryCount: 1,
      errorType: 'TIMEOUT_ERROR',
      errorMessage: 'Gemini lead analysis exceeded timeout of 15000ms with token AIzaSyA1234567890abcdefghijklmnopqrstuv',
    });

    expect(created).not.toBeNull();

    const found = await prisma.aiExecutionLog.findUnique({
      where: { correlationId },
    });

    expect(found?.status).toBe('FAILED');
    expect(found?.errorType).toBe('TIMEOUT_ERROR');
    // Verify API key was sanitized before persistence
    expect(found?.errorMessage).not.toContain('AIzaSyA1234567890abcdefghijklmnopqrstuv');
    expect(found?.errorMessage).toContain('[REDACTED_API_KEY]');
  }, 30000);

  it('cascades deletion of execution logs when lead is deleted', async () => {
    // 1. Create a temporary lead and execution log
    const tempLead = await prisma.lead.create({
      data: {
        userId: testUserId,
        name: `${TEST_PREFIX}Cascade Lead`,
        location: 'Hebbal, Bengaluru',
        propertyRequirement: '2 BHK',
        budgetInr: 9000000,
        buyingTimeline: '3-6 months',
        customerMessage: 'Looking for 2BHK in Hebbal.',
      },
    });

    const tempCorrelationId = generateCorrelationId();
    await recordAiExecution({
      correlationId: tempCorrelationId,
      leadId: tempLead.id,
      userId: testUserId,
      model: 'gemini-3.5-flash-lite',
      promptVersion: 'v1.1.0',
      status: 'SUCCESS',
      latencyMs: 250,
    });

    // Verify log exists
    const logBefore = await prisma.aiExecutionLog.findUnique({
      where: { correlationId: tempCorrelationId },
    });
    expect(logBefore).not.toBeNull();

    // 2. Delete the lead
    await prisma.lead.delete({
      where: { id: tempLead.id },
    });

    // 3. Verify execution log was cascade-deleted by PostgreSQL foreign key constraint
    const logAfter = await prisma.aiExecutionLog.findUnique({
      where: { correlationId: tempCorrelationId },
    });
    expect(logAfter).toBeNull();
  }, 30000);
});

