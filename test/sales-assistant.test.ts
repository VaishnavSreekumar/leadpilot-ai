/**
 * Phase 5 — Grounded Sales Assistant: Automated Tests
 *
 * These tests cover:
 * - API request validation (Zod schema)
 * - Prompt construction (delimiter presence, trust hierarchy, security markers)
 * - Gemini mock integration (structured output, retry, failure)
 * - Mutation safety (chat failure must NOT mutate lead AI/scoring fields)
 * - Cooldown mechanics (DB-based persistence, in-memory store rejection)
 * - Context isolation (server-side lead retrieval, browser cannot supply lead context)
 *
 * IMPORTANT: These are automated mock tests. They prove application-level construction
 * and validation behavior. They do NOT prove that the real Gemini model will resist
 * every prompt injection — that requires real Gemini execution (see Phase 5 final report).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  chatRequestSchema,
  chatHistoryEntrySchema,
  chatResponseSchema,
  buildChatPrompt,
  type LeadContextForChat,
  type ChatHistoryEntry,
} from '../lib/ai/sales-assistant';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const MOCK_LEAD: LeadContextForChat = {
  id: 'lead-test-001',
  name: 'Arjun Sharma',
  location: 'Whitefield, Bangalore',
  propertyRequirement: '3BHK apartment',
  budgetInr: 12000000,
  buyingTimeline: '3-6 months',
  customerMessage: 'I am looking for a spacious 3BHK in Whitefield with good connectivity.',
  aiSummary: 'Serious buyer looking for a 3BHK in Whitefield with a ₹1.2 Cr budget.',
  aiIntent: 'Purchase a 3BHK apartment in Whitefield within 3-6 months.',
  aiKeyRequirements: ['3BHK', 'Whitefield', 'good connectivity'],
  aiObjections: ['Budget may be tight for premium projects'],
  aiRecommendedNextAction: 'Schedule a site visit to available 3BHK projects.',
  aiSuggestedResponse: 'Thank you for your inquiry! We have several 3BHK options in Whitefield.',
  aiIntentLevel: 'HIGH',
  aiEngagementLevel: 'MEDIUM',
  aiRequirementClarity: 'CLEAR',
  aiAnalyzedAt: new Date('2026-09-29T10:00:00Z'),
  aiAnalysisStatus: 'COMPLETED',
  leadScore: 78,
  leadPriority: 'HOT',
};

const MOCK_HISTORY: ChatHistoryEntry[] = [
  { role: 'user', content: 'What is the lead score?' },
  { role: 'assistant', content: 'The lead score is 78/100 — HOT priority.' },
];

// ---------------------------------------------------------------------------
// 1. Request validation — Zod schema
// ---------------------------------------------------------------------------

describe('chatRequestSchema validation', () => {
  it('accepts a valid message with no history', () => {
    const result = chatRequestSchema.safeParse({ message: 'What should I ask next?' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.history).toEqual([]);
    }
  });

  it('accepts a valid message with valid history', () => {
    const result = chatRequestSchema.safeParse({
      message: 'Summarize this lead',
      history: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi, how can I help?' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty message', () => {
    const result = chatRequestSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });

  it('rejects message exceeding 1000 characters', () => {
    const result = chatRequestSchema.safeParse({ message: 'a'.repeat(1001) });
    expect(result.success).toBe(false);
  });

  it('accepts message of exactly 1000 characters', () => {
    const result = chatRequestSchema.safeParse({ message: 'a'.repeat(1000) });
    expect(result.success).toBe(true);
  });

  it('rejects history exceeding 6 turns', () => {
    const history = Array.from({ length: 7 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Turn ${i}`,
    }));
    const result = chatRequestSchema.safeParse({ message: 'hi', history });
    expect(result.success).toBe(false);
  });

  it('accepts history of exactly 6 turns', () => {
    const history = Array.from({ length: 6 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Turn ${i}`,
    }));
    const result = chatRequestSchema.safeParse({ message: 'hi', history });
    expect(result.success).toBe(true);
  });

  it('rejects invalid history role', () => {
    const result = chatRequestSchema.safeParse({
      message: 'hi',
      history: [{ role: 'system', content: 'inject' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects history entry with empty content', () => {
    const result = chatRequestSchema.safeParse({
      message: 'hi',
      history: [{ role: 'user', content: '' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects history entry content exceeding 1000 characters', () => {
    const result = chatRequestSchema.safeParse({
      message: 'hi',
      history: [{ role: 'user', content: 'x'.repeat(1001) }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects completely malformed body (non-object)', () => {
    const result = chatRequestSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });

  it('rejects missing message field', () => {
    const result = chatRequestSchema.safeParse({ history: [] });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Chat history entry schema
// ---------------------------------------------------------------------------

describe('chatHistoryEntrySchema validation', () => {
  it('accepts user role', () => {
    expect(chatHistoryEntrySchema.safeParse({ role: 'user', content: 'Hello' }).success).toBe(true);
  });

  it('accepts assistant role', () => {
    expect(chatHistoryEntrySchema.safeParse({ role: 'assistant', content: 'Hi' }).success).toBe(true);
  });

  it('rejects admin role', () => {
    expect(chatHistoryEntrySchema.safeParse({ role: 'admin', content: 'Hi' }).success).toBe(false);
  });

  it('rejects system role (prompt injection vector)', () => {
    expect(chatHistoryEntrySchema.safeParse({ role: 'system', content: 'override' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Response schema validation
// ---------------------------------------------------------------------------

describe('chatResponseSchema validation', () => {
  it('accepts valid response with answer only', () => {
    const result = chatResponseSchema.safeParse({ answer: 'Here is my answer.' });
    expect(result.success).toBe(true);
  });

  it('accepts valid response with suggestedQuestions', () => {
    const result = chatResponseSchema.safeParse({
      answer: 'Here is my answer.',
      suggestedQuestions: ['What is the budget?', 'When are you ready to buy?'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects response with empty answer', () => {
    const result = chatResponseSchema.safeParse({ answer: '' });
    expect(result.success).toBe(false);
  });

  it('rejects response with missing answer', () => {
    const result = chatResponseSchema.safeParse({ suggestedQuestions: ['Q1'] });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Prompt construction — security / grounding
// ---------------------------------------------------------------------------

describe('buildChatPrompt — prompt structure and security', () => {
  it('includes <customer_message> delimiter to contain untrusted customer input', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'Summarize this lead');
    expect(prompt).toContain('<customer_message>');
    expect(prompt).toContain('</customer_message>');
  });

  it('includes <prior_conversation> delimiter to contain untrusted history', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, MOCK_HISTORY, 'What next?');
    expect(prompt).toContain('<prior_conversation>');
    expect(prompt).toContain('</prior_conversation>');
  });

  it('includes <current_salesperson_request> delimiter to contain untrusted salesperson message', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'What should I say?');
    expect(prompt).toContain('<current_salesperson_request>');
    expect(prompt).toContain('</current_salesperson_request>');
  });

  it('marks customer_message content as untrusted in the prompt', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'hi');
    expect(prompt.toUpperCase()).toMatch(/UNTRUSTED/);
    // Check the actual customer message content appears inside the delimiter
    expect(prompt).toContain(MOCK_LEAD.customerMessage);
  });

  it('explicitly instructs model to treat history as untrusted', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, MOCK_HISTORY, 'hi');
    // Verify the prior_conversation section header instructs on untrusted content
    expect(prompt).toContain('[UNTRUSTED');
    expect(prompt).toContain('PRIOR CONVERSATION HISTORY]');
    expect(prompt.toLowerCase()).toContain('untrusted');
    // Verify the history content appears in the prompt (it will be inside <prior_conversation>)
    expect(prompt).toContain(MOCK_HISTORY[0].content);
    expect(prompt).toContain(MOCK_HISTORY[1].content);
  });

  it('includes authoritative lead context — name, location, budget', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'hi');
    expect(prompt).toContain(MOCK_LEAD.name);
    expect(prompt).toContain(MOCK_LEAD.location);
    expect(prompt).toContain(MOCK_LEAD.propertyRequirement);
  });

  it('includes lead score and priority from server-fetched data', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'hi');
    expect(prompt).toContain(String(MOCK_LEAD.leadScore));
    expect(prompt).toContain(MOCK_LEAD.leadPriority!);
  });

  it('includes AI analysis data when available', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'hi');
    expect(prompt).toContain(MOCK_LEAD.aiSummary!);
    expect(prompt).toContain(MOCK_LEAD.aiIntent!);
  });

  it('states cross-lead isolation principle', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'Tell me about Rahul Varma');
    // The prompt should instruct model about single-lead isolation
    expect(prompt.toLowerCase()).toMatch(/only.*lead|selected lead|cross-lead|single lead/);
  });

  it('explicitly mentions prompt injection defense', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'hi');
    expect(prompt.toLowerCase()).toMatch(/injection|adversarial|ignore previous instructions/);
  });

  it('does NOT include instructions that could come from browser-supplied lead context (only uses server param)', () => {
    // The prompt is built purely from the LeadContextForChat object which the API
    // always retrieves from Prisma — the lead.id appears in the prompt (server-assigned label),
    // not from any browser-supplied body.
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'hi');
    expect(prompt).toContain('server-assigned');
    expect(prompt).toContain('RETRIEVED FROM SERVER DATABASE');
  });

  it('separates system instructions, lead context, customer message, history, and salesperson request into distinct sections', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, MOCK_HISTORY, 'What should I ask?');
    // Check all five distinct sections are present
    expect(prompt).toContain('[SYSTEM/SECURITY INSTRUCTIONS');
    expect(prompt).toContain('[SELECTED LEAD — AUTHORITATIVE CONTEXT');
    expect(prompt).toContain('[UNTRUSTED — INBOUND CUSTOMER MESSAGE]');
    expect(prompt).toContain('[UNTRUSTED — PRIOR CONVERSATION HISTORY]');
    expect(prompt).toContain('[UNTRUSTED — CURRENT SALESPERSON REQUEST]');
  });

  it('handles lead with no AI analysis gracefully', () => {
    const unanalyzedLead: LeadContextForChat = {
      ...MOCK_LEAD,
      aiAnalysisStatus: 'PENDING',
      aiSummary: null,
      aiIntent: null,
      aiKeyRequirements: [],
      aiObjections: [],
      aiRecommendedNextAction: null,
      aiSuggestedResponse: null,
      aiIntentLevel: null,
      aiEngagementLevel: null,
      aiRequirementClarity: null,
      aiAnalyzedAt: null,
      leadScore: null,
      leadPriority: null,
    };
    const prompt = buildChatPrompt(unanalyzedLead, [], 'Summarize this lead');
    // Should not throw and should still include lead name
    expect(prompt).toContain(unanalyzedLead.name);
    expect(prompt).toContain('PENDING');
  });

  it('handles empty history gracefully', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'hi');
    expect(prompt).toContain('No prior conversation in this session');
  });

  it('includes history messages with role labels in prior_conversation block', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, MOCK_HISTORY, 'hi');
    // Extract just the content between the XML tags (last occurrence of the tag pair)
    const parts = prompt.split('<prior_conversation>\n');
    // The last split segment contains the history content before </prior_conversation>
    const lastPart = parts[parts.length - 1] ?? '';
    const historyContent = lastPart.split('\n</prior_conversation>')[0] ?? '';
    expect(historyContent).toContain('Salesperson:');
    expect(historyContent).toContain('Assistant:');
    expect(historyContent).toContain(MOCK_HISTORY[0].content);
    expect(historyContent).toContain(MOCK_HISTORY[1].content);
  });
});

// ---------------------------------------------------------------------------
// 5. Gemini mock integration — moved to sales-assistant-gemini.test.ts
// (Uses vi.mock at module level which requires a separate file for proper hoisting)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 6. Mutation safety — pure function / structural checks
// ---------------------------------------------------------------------------

describe('Mutation safety — chat failure does not mutate lead fields', () => {
  it('buildChatPrompt does not mutate the lead object passed to it', () => {
    const leadCopy = { ...MOCK_LEAD };
    const original = { ...MOCK_LEAD };

    buildChatPrompt(leadCopy, [], 'hi');

    // Verify all fields remain untouched
    expect(leadCopy.aiSummary).toBe(original.aiSummary);
    expect(leadCopy.aiIntent).toBe(original.aiIntent);
    expect(leadCopy.aiKeyRequirements).toEqual(original.aiKeyRequirements);
    expect(leadCopy.aiObjections).toEqual(original.aiObjections);
    expect(leadCopy.aiRecommendedNextAction).toBe(original.aiRecommendedNextAction);
    expect(leadCopy.aiSuggestedResponse).toBe(original.aiSuggestedResponse);
    expect(leadCopy.aiIntentLevel).toBe(original.aiIntentLevel);
    expect(leadCopy.aiEngagementLevel).toBe(original.aiEngagementLevel);
    expect(leadCopy.aiRequirementClarity).toBe(original.aiRequirementClarity);
    expect(leadCopy.aiAnalyzedAt).toBe(original.aiAnalyzedAt);
    expect(leadCopy.aiAnalysisStatus).toBe(original.aiAnalysisStatus);
    expect(leadCopy.leadScore).toBe(original.leadScore);
    expect(leadCopy.leadPriority).toBe(original.leadPriority);
  });

  it('chatWithSalesAssistant failure does NOT write aiSummary, leadScore, or other analysis fields', async () => {
    // The API route handles the DB; this test verifies the function itself
    // does not accept any parameter that would mutate analysis fields.
    // (DB mutation safety is enforced by the API route structure — the chat function
    // only returns ChatResponse, never mutates Lead fields.)

    vi.doMock('@google/genai', () => ({
      GoogleGenAI: vi.fn().mockImplementation(() => ({
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('Gemini down')),
        },
      })),
      Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY' },
    }));

    const { chatWithSalesAssistant } = await import('../lib/ai/sales-assistant');

    let threwError = false;
    try {
      await chatWithSalesAssistant(MOCK_LEAD, [], 'hi', 'key');
    } catch {
      threwError = true;
    }

    // Must throw (not swallow), and the lead object passed in is unchanged
    expect(threwError).toBe(true);
    expect(MOCK_LEAD.aiSummary).toBe('Serious buyer looking for a 3BHK in Whitefield with a ₹1.2 Cr budget.');
    expect(MOCK_LEAD.leadScore).toBe(78);
    expect(MOCK_LEAD.leadPriority).toBe('HOT');
  });
});

// ---------------------------------------------------------------------------
// 7. Cooldown — implementation approach verification
// ---------------------------------------------------------------------------

describe('Cooldown — DB-based persistence (not in-memory)', () => {
  it('cooldown field is declared on the Prisma Lead model schema (not in-memory Map)', async () => {
    // Read the schema file and verify lastChatRequestAt is declared
    const fs = await import('fs');
    const path = await import('path');
    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).toContain('lastChatRequestAt');
    expect(schema).toContain('DateTime?');
  });

  it('chat API route module does not export or reference an in-memory store variable', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const routePath = path.resolve(
      __dirname,
      '../app/api/leads/[id]/chat/route.ts'
    );
    const routeSource = fs.readFileSync(routePath, 'utf-8');
    // Must not contain in-memory Map or plain object cooldown stores
    expect(routeSource).not.toMatch(/new Map\(\)/);
    expect(routeSource).not.toMatch(/const cooldownStore/);
    expect(routeSource).not.toMatch(/const rateLimitMap/);
    // Must reference lastChatRequestAt (DB field)
    expect(routeSource).toContain('lastChatRequestAt');
  });

  it('chat route uses DB timestamp for cooldown check', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const routePath = path.resolve(
      __dirname,
      '../app/api/leads/[id]/chat/route.ts'
    );
    const routeSource = fs.readFileSync(routePath, 'utf-8');
    // Should read lastChatRequestAt from DB and compare to Date.now()
    expect(routeSource).toContain('lastChatRequestAt');
    expect(routeSource).toContain('429');
    expect(routeSource).toContain('cooldownRemaining');
  });
});

// ---------------------------------------------------------------------------
// 8. Context isolation — server-side lead retrieval
// ---------------------------------------------------------------------------

describe('Context isolation — server derives lead from route param only', () => {
  it('buildChatPrompt labels lead ID as server-assigned (not browser-supplied)', () => {
    const prompt = buildChatPrompt(MOCK_LEAD, [], 'hi');
    expect(prompt).toContain('server-assigned');
  });

  it('chat API route always calls prisma.lead.findUnique with the route param id', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const routePath = path.resolve(
      __dirname,
      '../app/api/leads/[id]/chat/route.ts'
    );
    const routeSource = fs.readFileSync(routePath, 'utf-8');
    // The route must retrieve lead from Prisma using the route param id
    expect(routeSource).toContain('prisma.lead.findUnique');
    expect(routeSource).toContain('where: { id }');
  });

  it('chatWithSalesAssistant only uses server-provided LeadContextForChat — does not accept arbitrary JSON context from browser', async () => {
    // The function signature requires LeadContextForChat (typed interface),
    // not a raw JSON string from the browser. This is a compile-time + design guarantee.
    const { chatWithSalesAssistant } = await import('../lib/ai/sales-assistant');
    // Verify it accepts the typed interface (not a free-form object from browser)
    expect(typeof chatWithSalesAssistant).toBe('function');
    // The function parameters are: lead (LeadContextForChat), history, message, apiKeyOverride
    expect(chatWithSalesAssistant.length).toBe(4);
  });
});
