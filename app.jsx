'use client';

import { useState, useEffect } from 'react';

export default function CuadrillaMidnightDashboard() {
  const [agents, setAgents] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timestamp, setTimestamp] = useState(new Date());

  const AGENT_COLORS = {
    R2: { bg: 'from-cyan-900 to-cyan-800', border: 'border-cyan-500', color: '#3ec6ff', emoji: '🤖' },
    'BB-8': { bg: 'from-orange-900 to-orange-800', border: 'border-orange-500', color: '#ff9a4d', emoji: '⛏️' },
    'C-3PO': { bg: 'from-purple-900 to-purple-800', border: 'border-purple-500', color: '#c39bff', emoji: '🪵' }
  };

  const fetchAgentStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://r2-telegram-reporter.vercel.app/api/agent-status');
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      if (data.success && data.agents) {
        setAgents(data.agents);
        setTimestamp(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching agent status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (agent) => {
    if (agent.hunger > 80) return 'bg-red-500/20 text-red-300';
    if (agent.working) return 'bg-green-500/20 text-green-300';
    return 'bg-gray-500/20 text-gray-300';
  };

  const getStatusText = (agent) => {
    if (agent.hunger > 80) return '⚠️ Hambre';
    if (agent.working) return '✓ Trabajando';
    return '○ OK';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-12">
          <div className="text-sm tracking-widest text-cyan-400 mb-2">🌙 CENTRO DE MANDO</div>
          <h1 className="text-5xl font-bold mb-2">Cuadrilla Midnight</h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>R2 · BB-8 · C-3PO — Autopilot 24/7</span>
            <span>|</span>
            <span>
              {loading ? '⟳ Cargando...' : `✓ ${timestamp.toLocaleTimeString()}`}
            </span>
            <span>|</span>
            <span>Auto-refresh: 30s</span>
          </div>
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200">
            ❌ Error: {error}
          </div>
        )}

        {/* AGENTS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {loading && !agents ? (
            <div className="col-span-full text-center py-12">
              <div className="inline-block animate-spin">⟳</div>
              <p className="mt-4 text-gray-400">Cargando datos en vivo...</p>
            </div>
          ) : agents ? (
            agents.map((agent) => {
              const colors = AGENT_COLORS[agent.name] || AGENT_COLORS.R2;
              return (
                <div
                  key={agent.name}
                  className={`bg-gradient-to-br ${colors.bg} border-2 ${colors.border} rounded-xl p-6 hover:shadow-lg transition-all`}
                  style={{
                    boxShadow: `inset 0 0 20px rgba(0,0,0,0.5), 0 0 20px ${colors.color}40`
                  }}
                >
                  {/* AGENT HEADER */}
                  <div className="flex items-start gap-4 mb-6">
                    <div
                      className={`w-20 h-24 rounded-lg border-2 ${colors.border} flex items-center justify-center text-3xl flex-shrink-0`}
                      style={{ background: 'rgba(0,0,0,0.3)' }}
                    >
                      {colors.emoji}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold" style={{ color: colors.color }}>
                        {agent.name}
                      </h3>
                      <p className="text-gray-300 text-sm uppercase tracking-wider">
                        {agent.profession}
                      </p>
                    </div>
                  </div>

                  {/* STATS */}
                  <div className="space-y-3 mb-6 text-sm">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-gray-400">Level</span>
                      <span className="font-mono font-bold">L{agent.level}</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-gray-400">XP</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r"
                            style={{
                              background: `linear-gradient(to right, ${colors.color}, ${colors.color}99)`,
                              width: `${agent.xpPercent}%`
                            }}
                          />
                        </div>
                        <span className="font-mono">{agent.xpPercent}%</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-gray-400">Crystals</span>
                      <span className="font-mono font-bold">{agent.crystals}</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-gray-400">Hambre</span>
                      <span className="font-mono">
                        {agent.hunger}/100
                        {agent.hunger > 80 && ' ⚠️'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-gray-400">Locación</span>
                      <span className="font-mono">{agent.location || '?'}</span>
                    </div>

                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-gray-400">Velocidad</span>
                      <span className="font-mono">{agent.speed}%</span>
                    </div>
                  </div>

                  {/* STATUS BADGE */}
                  <div className={`px-3 py-1.5 rounded-md text-xs font-bold w-fit ${getStatusColor(agent)}`}>
                    {getStatusText(agent)}
                  </div>
                </div>
              );
            })
          ) : null}
        </div>

        {/* FOOTER */}
        <div className="mt-12 text-center text-xs text-gray-500">
          Datos en vivo cada 30 segundos | Autopilot activo 24/7
        </div>
      </div>
    </div>
  );
}
