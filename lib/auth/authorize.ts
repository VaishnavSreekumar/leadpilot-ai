import 'server-only';
import { prisma } from '@/lib/db';
import type { Lead } from '@prisma/client';

export type AuthorizationResult =
  | { authorized: true; lead: Lead }
  | { authorized: false; status: 403 | 404; error: string };

/**
 * Validates whether a given user is authorized to access or modify a specific lead record.
 * Protects against Insecure Direct Object Reference (IDOR) attacks and enforces data isolation.
 *
 * Rules:
 * 1. If lead does not exist -> 404 "Lead not found"
 * 2. If lead is unassigned (userId === null) -> 404 "Lead not found" (quarantines legacy records from unowned access)
 * 3. If lead belongs to another user -> 404 "Lead not found" (prevents IDOR enumeration of other users' lead IDs)
 * 4. If lead belongs to the user (lead.userId === userId) -> Authorized
 */
export async function assertLeadAccess(
  leadId: string,
  userId: string
): Promise<AuthorizationResult> {
  if (!leadId || typeof leadId !== 'string') {
    return { authorized: false, status: 404, error: 'Lead not found' };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    return { authorized: false, status: 404, error: 'Lead not found' };
  }

  // Strict ownership check: leads without an owner (quarantined) or belonging to other users are rejected
  if (!lead.userId || lead.userId !== userId) {
    return {
      authorized: false,
      status: 404,
      error: 'Lead not found or you do not have permission to access it',
    };
  }

  return { authorized: true, lead };
}

