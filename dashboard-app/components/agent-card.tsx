'use client'

import { useState } from 'react'
import type { NormalizedAgent } from '@/lib/agents'
import { getAgentVisual, getProfessionIcon } from '@/lib/agents'

export function AgentCard({ agent }: { agent: NormalizedAgent }) {
  const [isFlipped, setIsFlipped] = useState(false)
  const visual = getAgentVisual(agent.name)
  const xpText = agent.xp !== null && agent.xpMax !== null ? `${agent.xp} / ${agent.xpMax} XP` : `${Math.round(agent.xpPercent)}% XP`

  return (
    <article className="group [perspective:1200px]">
      <div
        className={`relative min-h-[360px] w-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
      >
        <div
          className="absolute inset-0 overflow-hidden rounded-3xl border-2 bg-slate-900/90 p-5 [backface-visibility:hidden]"
          style={{
            borderColor: visual.color,
            boxShadow: `0 0 40px -12px ${visual.glow}, 0 0 0 1px rgba(255,255,255,0.03)`,
          }}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          <CardFlipButton isFlipped={false} onClick={() => setIsFlipped(true)} />

          <header className="mb-4 flex items-start justify-between gap-3 pr-16">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ backgroundColor: `${visual.color}1a`, boxShadow: `inset 0 0 0 1px ${visual.color}55` }}>
                <span aria-hidden="true">{visual.emoji}</span>
              </div>
              <div>
                <h2 className="font-mono text-lg font-bold tracking-wide text-white">{agent.name}</h2>
                {agent.profession && <p className="flex items-center gap-1 text-xs uppercase tracking-widest text-slate-400"><span aria-hidden="true">{getProfessionIcon(agent.profession)}</span>{agent.profession}</p>}
              </div>
            </div>
            {agent.level !== null && <span className="rounded-full px-2.5 py-1 font-mono text-xs font-bold text-slate-950" style={{ backgroundColor: visual.color }}>LV {agent.level}</span>}
          </header>

          <div className="mb-4 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${agent.isOnline ? 'animate-pulse' : ''}`} style={{ backgroundColor: agent.isOnline ? '#4ade80' : '#f87171' }} aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-300">{agent.isOnline ? 'Online' : agent.statusLabel}</span>
          </div>

          <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-400">
            <span>XP progress</span><span className="font-mono text-white">{Math.round(agent.xpPercent)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800" aria-label={`XP ${Math.round(agent.xpPercent)} por ciento`} role="progressbar" aria-valuenow={Math.round(agent.xpPercent)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${agent.xpPercent}%`, background: `linear-gradient(90deg, ${visual.color}99, ${visual.color})` }} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-500">{xpText}</p>

          {agent.extraStats.length > 0 && <dl className="mt-4 grid grid-cols-2 gap-2">{agent.extraStats.slice(0, 4).map((stat) => <div key={stat.label} className="rounded-lg bg-slate-800/60 px-2.5 py-1.5"><dt className="text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</dt><dd className="truncate font-mono text-sm text-slate-200">{stat.value}</dd></div>)}</dl>}
          {agent.errorMessage && <p className="mt-4 truncate rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 font-mono text-[11px] text-red-300" title={agent.errorMessage}>{agent.errorMessage}</p>}
        </div>

        <div className="absolute inset-0 overflow-hidden rounded-3xl border-2 bg-slate-950 p-5 [backface-visibility:hidden] [transform:rotateY(180deg)]" style={{ borderColor: visual.color, boxShadow: `0 0 40px -12px ${visual.glow}` }}>
          <CardFlipButton isFlipped onClick={() => setIsFlipped(false)} />
          <div className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-4 pr-16">
            <span className="text-2xl" aria-hidden="true">{visual.emoji}</span>
            <div><p className="font-mono text-xs uppercase tracking-[0.22em]" style={{ color: visual.color }}>Agent dossier</p><h2 className="font-mono text-lg font-bold text-white">{agent.name}</h2></div>
          </div>
          <dl className="flex max-h-[275px] flex-col gap-3 overflow-y-auto pr-1">
            <DetailRow label="Estado" value={agent.statusLabel} />
            {agent.level !== null && <DetailRow label="Nivel" value={`LV ${agent.level}`} />}
            <DetailRow label="XP" value={xpText} />
            {agent.profession && <DetailRow label="Profesión" value={`${getProfessionIcon(agent.profession)} ${agent.profession}`} />}
            {agent.details.map((detail) => <DetailRow key={detail.label} label={detail.label} value={detail.value} />)}
            {agent.errorMessage && <DetailRow label="Error API" value={agent.errorMessage} />}
          </dl>
        </div>
      </div>
    </article>
  )
}

function CardFlipButton({ isFlipped, onClick }: { isFlipped: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={isFlipped ? 'Volver al resumen' : 'Ver todos los datos del agente'} className="absolute right-4 top-4 z-10 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-300 transition-colors hover:border-slate-400 hover:text-white">{isFlipped ? '← Frente' : '↻ Datos'}</button>
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"><dt className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</dt><dd className="break-words font-mono text-xs text-slate-200">{value}</dd></div>
}

export function AgentCardSkeleton() {
  return <div className="animate-pulse rounded-3xl border-2 border-slate-800 bg-slate-900/60 p-5"><div className="mb-4 flex items-center gap-3"><div className="h-14 w-14 rounded-2xl bg-slate-800" /><div className="space-y-2"><div className="h-4 w-20 rounded bg-slate-800" /><div className="h-3 w-14 rounded bg-slate-800" /></div></div><div className="mb-4 h-3 w-16 rounded bg-slate-800" /><div className="h-3 w-full rounded-full bg-slate-800" /></div>
}
