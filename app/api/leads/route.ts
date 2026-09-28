import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { leadInputSchema } from '@/lib/validations/lead';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body' },
        { status: 400 }
      );
    }

    const validationResult = leadInputSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const newLead = await prisma.lead.create({
      data: validationResult.data,
    });

    return NextResponse.json(newLead, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database operation failed';
    console.error('[POST /api/leads Error]:', message);

    return NextResponse.json(
      { error: 'Failed to create lead. Please try again later.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ leads }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database query failed';
    console.error('[GET /api/leads Error]:', message);

    return NextResponse.json(
      { error: 'Failed to fetch leads. Please try again later.' },
      { status: 500 }
    );
  }
}
