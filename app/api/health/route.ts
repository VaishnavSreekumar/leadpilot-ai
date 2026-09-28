import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Actually test the database connectivity with a lightweight ping
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    // Log internally but never leak connection strings or credentials to client
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[Health Check Failed]:', errorMessage);

    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        message: 'Database connection check failed',
      },
      { status: 503 }
    );
  }
}
