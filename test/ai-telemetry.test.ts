import { describe, it, expect, vi } from 'vitest';
import {
  generateCorrelationId,
  sanitizeErrorMessage,
  classifyAiError,
  assessExtractionQuality,
  recordAiExecution,
} from '@/lib/observability/telemetry';
import { AiTimeoutError } from '@/lib/reliability/ai-request';
import { prisma } from '@/lib/db';

describe('Phase 3 — AI Telemetry & Observability Unit Tests', () => {
  describe('Correlation ID Generation', () => {
    it('generates a valid RFC 4122 UUIDv4 string', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();

      const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(id1).toMatch(uuidv4Regex);
      expect(id2).toMatch(uuidv4Regex);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Error Sanitization (Security & Privacy)', () => {
    it('redacts Google / Gemini API keys matching AIza... prefix', () => {
      const raw = 'Failed to fetch Gemini response: AIzaSyA1234567890abcdefghijklmnopqrstuv is invalid.';
      const sanitized = sanitizeErrorMessage(raw);

      expect(sanitized).not.toContain('AIzaSyA1234567890abcdefghijklmnopqrstuv');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    });

    it('redacts query parameter tokens and keys', () => {
      const raw = 'Request to https://generativelanguage.googleapis.com/v1beta?key=secret_gemini_key_123 failed';
      const sanitized = sanitizeErrorMessage(raw);

      expect(sanitized).not.toContain('secret_gemini_key_123');
      expect(sanitized).toContain('key=[REDACTED]');
    });

    it('redacts Bearer authentication tokens', () => {
      const raw = 'Authorization failed: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz';
      const sanitized = sanitizeErrorMessage(raw);

      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz');
      expect(sanitized).toContain('Bearer [REDACTED]');
    });

    it('redacts customer email addresses to prevent PII leakage into logs', () => {
      const raw = 'Customer buyer.lead@realestate.com reported unexpected token';
      const sanitized = sanitizeErrorMessage(raw);

      expect(sanitized).not.toContain('buyer.lead@realestate.com');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
    });

    it('redacts phone numbers to prevent customer PII exposure', () => {
      const raw = 'Contact +91-9876543210 returned invalid payload';
      const sanitized = sanitizeErrorMessage(raw);

      expect(sanitized).not.toContain('9876543210');
      expect(sanitized).toContain('[REDACTED_PHONE]');
    });

    it('truncates oversized error messages to max 500 characters', () => {
      const oversized = 'A'.repeat(800);
      const sanitized = sanitizeErrorMessage(oversized);

      expect(sanitized.length).toBe(500);
      expect(sanitized.endsWith('...')).toBe(true);
    });
  });

  describe('Error Classification', () => {
    it('classifies AiTimeoutError as TIMEOUT_ERROR', () => {
      const err = new AiTimeoutError('Gemini request exceeded 15000ms', 15000);
      const { errorType } = classifyAiError(err);
      expect(errorType).toBe('TIMEOUT_ERROR');
    });

    it('classifies deadline exceeded or ETIMEDOUT string as TIMEOUT_ERROR', () => {
      const err = new Error('connect ETIMEDOUT 142.250.190.42:443');
      const { errorType } = classifyAiError(err);
      expect(errorType).toBe('TIMEOUT_ERROR');
    });

    it('classifies JSON parse or Zod schema errors as VALIDATION_ERROR', () => {
      const schemaErr = new Error('Structured output schema validation failed: {"summary":["Required"]}');
      const { errorType } = classifyAiError(schemaErr);
      expect(errorType).toBe('VALIDATION_ERROR');

      const jsonErr = new Error('Failed to parse Gemini response as JSON: Unexpected token');
      expect(classifyAiError(jsonErr).errorType).toBe('VALIDATION_ERROR');
    });

    it('classifies quota / 429 / provider network drops as PROVIDER_ERROR', () => {
      const quotaErr = new Error('Quota exceeded for resource (429 Too Many Requests)');
      expect(classifyAiError(quotaErr).errorType).toBe('PROVIDER_ERROR');

      const providerErr = new Error('GoogleGenAI 503 Service Unavailable');
      expect(classifyAiError(providerErr).errorType).toBe('PROVIDER_ERROR');

      const connErr = new Error('read ECONNRESET');
      expect(classifyAiError(connErr).errorType).toBe('PROVIDER_ERROR');
    });

    it('classifies generic exceptions as INTERNAL_ERROR', () => {
      const internalErr = new TypeError('Cannot read properties of undefined (reading calculate)');
      expect(classifyAiError(internalErr).errorType).toBe('INTERNAL_ERROR');
    });
  });

  describe('Extraction Quality Assessment', () => {
    it('reports zero uncertain fields for high-confidence complete extractions', () => {
      const quality = assessExtractionQuality({
        intentLevel: 'HIGH',
        engagementLevel: 'HIGH',
        requirementClarity: 'CLEAR',
        keyRequirements: ['3 BHK', 'Koramangala'],
        objections: ['Price expectation is firm at 3 Cr'],
        suggestedQuestions: ['What is your preferred possession month?'],
      });

      expect(quality.uncertainFields).toEqual([]);
      expect(quality.keyRequirementsCount).toBe(2);
      expect(quality.objectionsCount).toBe(1);
      expect(quality.suggestedQuestionsCount).toBe(1);
    });

    it('flags low intent, unclear requirements, and low engagement as uncertain', () => {
      const quality = assessExtractionQuality({
        intentLevel: 'LOW',
        engagementLevel: 'LOW',
        requirementClarity: 'UNCLEAR',
        keyRequirements: [],
        objections: [],
        suggestedQuestions: [],
      });

      expect(quality.uncertainFields).toContain('intentLevel');
      expect(quality.uncertainFields).toContain('engagementLevel');
      expect(quality.uncertainFields).toContain('requirementClarity');
      expect(quality.uncertainFields).toContain('keyRequirements');
      expect(quality.uncertainFields).toContain('objections');
      expect(quality.uncertainFields).toContain('suggestedQuestions');
    });

    it('flags objections with explicit uncertainty keywords (unspecified/missing)', () => {
      const quality = assessExtractionQuality({
        intentLevel: 'MEDIUM',
        engagementLevel: 'MEDIUM',
        requirementClarity: 'PARTIAL',
        keyRequirements: ['Villa'],
        objections: ['Possession date is unspecified', 'Budget range is missing details'],
        suggestedQuestions: ['Are you open to under-construction projects?'],
      });

      expect(quality.uncertainFields).toContain('objections');
    });
  });

  describe('Resiliency Guarantee: Non-blocking Telemetry Persistence', () => {
    it('returns null and never throws when database persistence fails', async () => {
      const createSpy = vi.spyOn(prisma.aiExecutionLog, 'create').mockRejectedValueOnce(
        new Error('PostgreSQL connection dropped')
      );

      const result = await recordAiExecution({
        correlationId: generateCorrelationId(),
        leadId: 'mock-lead-id',
        userId: 'mock-user-id',
        model: 'gemini-3.5-flash-lite',
        promptVersion: 'v1.1.0',
        status: 'SUCCESS',
        latencyMs: 350,
      });

      expect(result).toBeNull();
      createSpy.mockRestore();
    });
  });
});

