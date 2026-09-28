import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ lead }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database query failed';
    console.error('[GET /api/leads/[id] Error]:', message);

    return NextResponse.json(
      { error: 'Failed to fetch lead details. Please try again later.' },
      { status: 500 }
    );
  }
}
