'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { AgentCard, AgentCardSkeleton } from '@/components/agent-card'
import { normalizeAgent, type AgentStatusResponse } from '@/lib/agents'

const REFRESH_INTERVAL_MS = 30_000

async function fetcher(url: string): Promise<AgentStatusResponse> {
  const res = await fetch(url)
  const data = (await res.json()) as AgentStatusResponse
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? `La solicitud falló con estado ${res.status}`)
  }
  return data
}

export function AgentDashboard() {
  const [bb8Monitor, setBB8Monitor] = useState<any>(null)

  const { data, error, isLoading, isValidating, mutate } = useSWR<AgentStatusResponse>('/api/agents', fetcher, {
    refreshInterval: REFRESH_INTERVAL_MS,
    revalidateOnFocus: false,
  })

  useEffect(() => {
    const fetchBB8Monitor = async () => {
      try {
        const res = await fetch('/api/bb8-status-monitor')
        const monitorData = await res.json()
        setBB8Monitor(monitorData)
      } catch (err) {
        console.error('Failed to fetch BB-8 monitor:', err)
      }
    }
    fetchBB8Monitor()
    const interval = setInterval(fetchBB8Monitor, 30000)
    return () => clearInterval(interval)
  }, [])

  const agents = data?.agents?.map(normalizeAgent) ?? []
  const lastSync = data?.timestamp ? new Date(data.timestamp) : null
  const usingSnapshot = data?.dataSource === 'snapshot'

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Midnight City // Sector 7</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">Agent Control Deck</h1>
          <p className="mt-1 text-sm text-slate-400">Monitoreo en vivo de R2, BB-8 y C-3PO</p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5">
            <span
              className={`h-2 w-2 rounded-full ${error ? 'bg-red-400' : 'bg-emerald-400'} ${
                isValidating ? 'animate-pulse' : ''
              }`}
              aria-hidden="true"
            />
            <span className="font-mono text-xs text-slate-300">
              {error ? 'Conexión interrumpida' : 'Enlace activo'}
            </span>
          </div>
          <p className="font-mono text-[11px] text-slate-500">
            {lastSync ? `Última sincronización: ${lastSync.toLocaleTimeString('es-ES')}` : 'Sincronizando…'}
          </p>
          <button
            type="button"
            onClick={() => mutate()}
            className="rounded-full border border-slate-700 px-3 py-1 font-mono text-[11px] text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            Actualizar ahora
          </button>
        </div>
      </header>

      {(error || usingSnapshot || bb8Monitor?.status === 'OFFLINE') && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            bb8Monitor?.status === 'OFFLINE'
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : usingSnapshot
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {bb8Monitor?.status === 'OFFLINE'
            ? `🔴 BB-8 está OFFLINE (API Midnight City). Monitoreo activo. Se reconectará automáticamente.`
            : usingSnapshot
            ? `Mostrando el último estado guardado${data?.snapshotAgeSeconds != null ? ` hace ${Math.floor(data.snapshotAgeSeconds / 60)} min` : ''}. Se actualizará automáticamente cuando la API vuelva.`
            : `No se pudo contactar con la red de agentes: ${error?.message ?? 'Error desconocido'}`}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <AgentCardSkeleton key={i} />)
          : agents.map((agent) => <AgentCard key={agent.name} agent={agent} />)}
      </div>

      <footer className="mt-auto pt-6 text-center font-mono text-[11px] text-slate-600">
        Actualiza automáticamente cada 30 segundos
      </footer>
    </div>
  )
}
