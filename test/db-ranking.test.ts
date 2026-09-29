import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/db';
import { getLeadExplanation } from '../lib/scoring/lead-score';

describe('Live Dev DB Manual Verification (Section 13)', () => {
  const PREFIX = 'PHASE4_MANUAL_TEST_';
  let leadIds: string[] = [];

  beforeAll(async () => {
    // Clean up any previous test leads
    await prisma.lead.deleteMany({ where: { name: { startsWith: PREFIX } } });

    const now = Date.now();

    // 1. HOT / high score (100)
    const l1 = await prisma.lead.create({
      data: {
        name: `${PREFIX}Lead1_HOT_100`,
        location: 'Indiranagar, Bengaluru',
        propertyRequirement: '4 BHK Luxury Penthouse',
        budgetInr: 35000000,
        buyingTimeline: '0-3 months',
        customerMessage: 'Ready with cash, looking for immediate luxury penthouse in Indiranagar.',
        leadScore: 100,
        leadPriority: 'HOT',
        aiAnalysisStatus: 'COMPLETED',
        aiIntentLevel: 'HIGH',
        aiEngagementLevel: 'HIGH',
        aiRequirementClarity: 'CLEAR',
        createdAt: new Date(now - 60000),
      },
    });

    // 2. WARM / medium score (65)
    const l2 = await prisma.lead.create({
      data: {
        name: `${PREFIX}Lead2_WARM_65`,
        location: 'Whitefield, Bengaluru',
        propertyRequirement: '2 BHK Apartment',
        budgetInr: 9000000,
        buyingTimeline: '3-6 months',
        customerMessage: 'Looking for 2 BHK near ITPL, 3-6 months timeframe.',
        leadScore: 65,
        leadPriority: 'WARM',
        aiAnalysisStatus: 'COMPLETED',
        aiIntentLevel: 'MEDIUM',
        aiEngagementLevel: 'LOW',
        aiRequirementClarity: 'PARTIAL',
        createdAt: new Date(now - 50000),
      },
    });

    // 3. COLD / low score (40)
    const l3 = await prisma.lead.create({
      data: {
        name: `${PREFIX}Lead3_COLD_40`,
        location: 'Hebbal, Bengaluru',
        propertyRequirement: 'Plot or villa',
        budgetInr: 6000000,
        buyingTimeline: 'exploring',
        customerMessage: 'Just exploring options in north Bangalore.',
        leadScore: 40,
        leadPriority: 'COLD',
        aiAnalysisStatus: 'COMPLETED',
        aiIntentLevel: 'LOW',
        aiEngagementLevel: 'LOW',
        aiRequirementClarity: 'UNCLEAR',
        createdAt: new Date(now - 40000),
      },
    });

    // 4. PENDING / null score
    const l4 = await prisma.lead.create({
      data: {
        name: `${PREFIX}Lead4_PENDING_NullScore`,
        location: 'Koramangala, Bengaluru',
        propertyRequirement: '3 BHK Villa',
        budgetInr: 25000000,
        buyingTimeline: '0-3 months',
        customerMessage: 'Interested in villas in Koramangala.',
        leadScore: null,
        leadPriority: null,
        aiAnalysisStatus: 'PENDING',
        createdAt: new Date(now - 30000),
      },
    });

    // 5. FAILED + cached non-null score (75, HOT)
    const l5 = await prisma.lead.create({
      data: {
        name: `${PREFIX}Lead5_FAILED_CachedScore75`,
        location: 'HSR Layout, Bengaluru',
        propertyRequirement: '3 BHK Apartment',
        budgetInr: 18000000,
        buyingTimeline: '0-3 months',
        customerMessage: 'Inquired previously, ready to purchase.',
        leadScore: 75,
        leadPriority: 'HOT',
        aiAnalysisStatus: 'FAILED',
        aiIntentLevel: 'HIGH',
        aiEngagementLevel: 'LOW',
        aiRequirementClarity: 'PARTIAL',
        createdAt: new Date(now - 20000),
      },
    });

    // 6. FAILED + null score
    const l6 = await prisma.lead.create({
      data: {
        name: `${PREFIX}Lead6_FAILED_NullScore`,
        location: 'Electronic City, Bengaluru',
        propertyRequirement: '1 BHK Studio',
        budgetInr: 4000000,
        buyingTimeline: '6-12 months',
        customerMessage: 'Need studio flat for investment.',
        leadScore: null,
        leadPriority: null,
        aiAnalysisStatus: 'FAILED',
        createdAt: new Date(now - 10000),
      },
    });

    leadIds = [l1.id, l2.id, l3.id, l4.id, l5.id, l6.id];
  });

  afterAll(async () => {
    await prisma.lead.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  it('verifies explicit Prisma nulls: last ordering from PostgreSQL', async () => {
    const leads = await prisma.lead.findMany({
      where: { name: { startsWith: PREFIX } },
      orderBy: [
        { leadScore: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });

    expect(leads).toHaveLength(6);

    // Order must be: 100, 75, 65, 40, null (newer), null (older)
    const scores = leads.map((l) => l.leadScore);
    expect(scores[0]).toBe(100);
    expect(scores[1]).toBe(75);
    expect(scores[2]).toBe(65);
    expect(scores[3]).toBe(40);
    expect(scores[4]).toBeNull();
    expect(scores[5]).toBeNull();

    // Verify FAILED with score 75 ranks as #2 (between 100 and 65)
    expect(leads[1].name).toContain('Lead5_FAILED_CachedScore75');
    expect(leads[1].aiAnalysisStatus).toBe('FAILED');
    expect(leads[1].leadScore).toBe(75);

    // Verify FAILED with null score ranks among nulls at the end
    expect(leads[4].name).toContain('Lead6_FAILED_NullScore');
    expect(leads[5].name).toContain('Lead4_PENDING_NullScore');
  });

  it('verifies presentation-level filtering on dev database leads', async () => {
    const leads = await prisma.lead.findMany({
      where: { name: { startsWith: PREFIX } },
      orderBy: [
        { leadScore: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });

    // HOT filter
    const hotLeads = leads.filter((l) => l.leadScore !== null && l.leadPriority === 'HOT');
    expect(hotLeads).toHaveLength(2);
    expect(hotLeads[0].leadScore).toBe(100);
    expect(hotLeads[1].leadScore).toBe(75); // Lead5 (FAILED with cached score 75) is included in HOT!

    // Pending Analysis filter: strictly leadScore === null
    const pendingLeads = leads.filter((l) => l.leadScore === null);
    expect(pendingLeads).toHaveLength(2);
    expect(pendingLeads.map((l) => l.leadScore)).toEqual([null, null]);
    // Both Lead6 (FAILED with null score) and Lead4 (PENDING with null score) are here
    expect(pendingLeads.some((l) => l.name.includes('Lead6_FAILED_NullScore'))).toBe(true);
    expect(pendingLeads.some((l) => l.name.includes('Lead4_PENDING_NullScore'))).toBe(true);
  });

  it('verifies deterministic "Why this lead?" generation from DB fields', async () => {
    const lead100 = await prisma.lead.findFirst({
      where: { name: `${PREFIX}Lead1_HOT_100` },
    });

    expect(lead100).not.toBeNull();
    if (lead100) {
      const why = getLeadExplanation({
        intentLevel: lead100.aiIntentLevel,
        buyingTimeline: lead100.buyingTimeline,
        budgetInr: lead100.budgetInr,
        requirementClarity: lead100.aiRequirementClarity,
        engagementLevel: lead100.aiEngagementLevel,
      });

      expect(why.explanation).toBe('100/100 HOT — High intent, valid budget, clear requirements, high engagement, 0–3 month timeline.');
      expect(why.reasons).toEqual([
        'High intent',
        'Valid budget',
        'Clear requirements',
        'High engagement',
        '0–3 month timeline',
      ]);
    }
  });
});
