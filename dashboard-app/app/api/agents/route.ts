import { NextResponse } from 'next/server'
import { getAgentSnapshots, saveAgentSnapshots } from '@/lib/agent-snapshots'
import type { AgentStatusResponse, RawAgentStatus } from '@/lib/agents'

export const dynamic = 'force-dynamic'

const SOURCE_URL = 'https://r2-telegram-reporter.vercel.app/api/agent-status'

function snapshotResponse(rows: Awaited<ReturnType<typeof getAgentSnapshots>>, error?: string) {
  const latestSavedAt = rows.reduce<Date | null>((latest, row) => {
    const savedAt = new Date(row.savedAt)
    return !latest || savedAt > latest ? savedAt : latest
  }, null)
  const now = Date.now()

  return {
    success: rows.length > 0,
    timestamp: latestSavedAt?.toISOString() ?? new Date().toISOString(),
    agents: rows.map((row) => row.payload as RawAgentStatus),
    error,
    dataSource: 'snapshot' as const,
    snapshotSavedAt: latestSavedAt?.toISOString(),
    snapshotAgeSeconds: latestSavedAt ? Math.floor((now - latestSavedAt.getTime()) / 1000) : undefined,
  }
}

export async function GET() {
  try {
    const upstream = await fetch(SOURCE_URL, { cache: 'no-store' })
    const data = upstream.ok ? ((await upstream.json()) as AgentStatusResponse) : null

    if (data?.success && data.agents.length > 0) {
      await saveAgentSnapshots(data.agents, data.timestamp)
      return NextResponse.json({ ...data, dataSource: 'live' as const })
    }

    const rows = await getAgentSnapshots()
    const fallback = snapshotResponse(rows, data?.error ?? `El servidor de agentes respondió con estado ${upstream.status}`)
    return NextResponse.json(fallback, { status: rows.length ? 200 : 502 })
  } catch (error) {
    const rows = await getAgentSnapshots()
    const fallback = snapshotResponse(
      rows,
      error instanceof Error ? error.message : 'No se pudo contactar con la red de agentes',
    )
    return NextResponse.json(fallback, { status: rows.length ? 200 : 502 })
  }
}
