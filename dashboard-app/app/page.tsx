'use client';

import { useState, useEffect } from 'react';

interface Agent {
  name: string;
  profession: string;
  level: number;
  xpPercent: number;
  hunger: number;
  crystals: number;
  working: boolean;
  speed: number;
  location: string;
  skill: string;
}

type Tab = 'estado' | 'protocolos' | 'tecnologia' | 'historial' | 'api' | 'arquitectura' | 'ciudad' | 'documentacion' | 'dashboard-final';

export default function Home() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState(new Date());
  const [activeTab, setActiveTab] = useState<Tab>('estado');
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const AGENT_COLORS: Record<string, { bg: string; border: string; color: string; description: string }> = {
    R2: {
      bg: 'from-cyan-900 to-cyan-800',
      border: 'border-cyan-500',
      color: '#3ec6ff',
      description: 'Especialista en hacking y extracción de datos. Busca acceso a sistemas y contraseñas para maximizar recursos. Ritmo: ~426 XP/h'
    },
    'BB-8': {
      bg: 'from-orange-900 to-orange-800',
      border: 'border-orange-500',
      color: '#ff9a4d',
      description: 'Minero optimizado. Excava cristales y minerales. Umbral de sobrecarga: workSpeedPercent < 80%. Ritmo: ~200+ XP/h'
    },
    'C-3PO': {
      bg: 'from-purple-900 to-purple-800',
      border: 'border-purple-500',
      color: '#c39bff',
      description: 'Leñador experto. Cosecha madera de alta calidad. El más eficiente del equipo. Ritmo: ~4,407 XP/h'
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'estado', label: 'Estado' },
    { id: 'protocolos', label: 'Protocolos' },
    { id: 'tecnologia', label: 'Tecnología' },
    { id: 'historial', label: 'Historial' },
    { id: 'api', label: '🔌 API' },
    { id: 'arquitectura', label: '⚙️ Arquitectura' },
    { id: 'ciudad', label: '🏙️ City Scale' },
    { id: 'documentacion', label: '📚 Documentación' },
    { id: 'dashboard-final', label: '🎯 Dashboard Final' }
  ];

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
    } catch (err: any) {
      console.error('Error fetching agent status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 300000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (agent: Agent) => {
    if (agent.hunger > 80) return 'bg-red-500/20 text-red-300';
    if (agent.working) return 'bg-green-500/20 text-green-300';
    return 'bg-gray-500/20 text-gray-300';
  };

  const getStatusText = (agent: Agent) => {
    if (agent.hunger > 80) return '⚠️ Hambre';
    if (agent.working) return '✓ Trabajando';
    return '○ OK';
  };

  const toggleFlip = (name: string) => {
    setFlipped({ ...flipped, [name]: !flipped[name] });
  };

  const downloadDoc = (title: string, content: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/markdown;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `${title}.md`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadHTML = () => {
    const html = document.documentElement.outerHTML;
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(html));
    element.setAttribute('download', 'dashboard-v3.html');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <style>{`
        .flip-card {
          perspective: 1000px;
        }
        .flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s;
          transform-style: preserve-3d;
        }
        .flip-card.flipped .flip-card-inner {
          transform: rotateY(180deg);
        }
        .flip-card-front, .flip-card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .flip-card-back {
          transform: rotateY(180deg);
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="mb-8">
          <div className="text-sm tracking-widest text-cyan-400 mb-2">🌙 CENTRO DE MANDO</div>
          <h1 className="text-5xl font-bold mb-2">Cuadrilla Midnight</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <span>R2 · BB-8 · C-3PO — Autopilot 24/7</span>
            <span>|</span>
            <span>{loading ? '⟳ Cargando...' : `✓ ${timestamp.toLocaleTimeString('es-AR')}`}</span>
            <span>|</span>
            <span>Auto-refresh: 5m</span>
            <span>|</span>
            <button
              onClick={fetchAgentStatus}
              disabled={loading}
              className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? '⟳ Actualizando...' : '🔄 Actualizar'}
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 border-b border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ERROR STATE */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200">
            ❌ Error: {error}
          </div>
        )}

        {/* ESTADO TAB */}
        {activeTab === 'estado' && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              {loading && !agents ? (
                <div className="col-span-full text-center py-12">
                  <div className="inline-block animate-spin text-2xl">⟳</div>
                  <p className="mt-4 text-gray-400">Cargando datos en vivo...</p>
                </div>
              ) : agents ? (
                agents.map((agent) => {
                  const colors = AGENT_COLORS[agent.name] || AGENT_COLORS.R2;
                  const isFlipped = flipped[agent.name] || false;

                  return (
                    <div
                      key={agent.name}
                      className="flip-card h-96 cursor-pointer"
                      onClick={() => toggleFlip(agent.name)}
                    >
                      <div className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}>
                        {/* FRENTE */}
                        <div
                          className={`flip-card-front bg-gradient-to-br ${colors.bg} border-2 ${colors.border} rounded-xl p-6 flex flex-col justify-between`}
                          style={{
                            boxShadow: `inset 0 0 20px rgba(0,0,0,0.5), 0 0 20px ${colors.color}40`
                          }}
                        >
                          <div>
                            <div className="flex items-start gap-4 mb-6">
                              <div
                                className={`w-24 h-32 rounded-lg border-2 ${colors.border} flex items-center justify-center flex-shrink-0 overflow-hidden`}
                                style={{ background: 'rgba(0,0,0,0.3)' }}
                              >
                                <img
                                  src={`/images/${agent.name.toLowerCase().replace('-', '')}.png`}
                                  alt={agent.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <h3 className="text-2xl font-bold" style={{ color: colors.color }}>{agent.name}</h3>
                                <p className="text-gray-300 text-xs uppercase tracking-wider">{agent.profession}</p>
                              </div>
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Level</span>
                                <span className="font-mono font-bold">L{agent.level}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">XP</span>
                                <span className="font-mono font-bold">{agent.xpPercent}%</span>
                              </div>
                              <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mt-1">
                                <div
                                  style={{
                                    background: `linear-gradient(to right, ${colors.color}, ${colors.color}99)`,
                                    width: `${agent.xpPercent}%`,
                                    height: '100%'
                                  }}
                                />
                              </div>
                              <div className="flex justify-between pt-2">
                                <span className="text-gray-400">Crystals</span>
                                <span className="font-mono">{(agent.crystals || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Hambre</span>
                                <span className="font-mono">{agent.hunger}/100</span>
                              </div>
                            </div>
                          </div>

                          <div className={`px-3 py-1.5 rounded-md text-xs font-bold w-fit ${getStatusColor(agent)}`}>
                            {getStatusText(agent)}
                          </div>
                        </div>

                        {/* REVERSO */}
                        <div
                          className={`flip-card-back bg-gradient-to-br ${colors.bg} border-2 ${colors.border} rounded-xl p-6 flex flex-col justify-between`}
                          style={{
                            boxShadow: `inset 0 0 20px rgba(0,0,0,0.5), 0 0 20px ${colors.color}40`
                          }}
                        >
                          <div>
                            <h4 className="text-xl font-bold mb-4" style={{ color: colors.color }}>
                              {agent.profession.toUpperCase()}
                            </h4>
                            <p className="text-gray-200 text-sm leading-relaxed mb-6">
                              {colors.description}
                            </p>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-400">Locación</span>
                                <span className="font-mono">{agent.location || '?'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Velocidad</span>
                                <span className="font-mono">{agent.speed}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-400">Skill</span>
                                <span className="font-mono text-xs">{agent.skill || '?'}</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center">Click para voltear</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : null}
            </div>
          </div>
        )}

        {/* PROTOCOLOS TAB */}
        {activeTab === 'protocolos' && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8">
              <h2 className="text-3xl font-bold mb-6 text-cyan-400">🎯 Protocolos de Acción</h2>
              <p className="text-gray-300 mb-6">Lógica de decisión en tiempo real. Se ejecutan secuencialmente cada ciclo (cada 10 minutos).</p>

              <div className="space-y-6">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-red-400 mb-3">P0 — EMERGENCIA</h3>
                  <p className="text-gray-300 text-sm mb-3">Si se cumple → Acción inmediata, ignora todo lo demás</p>
                  <div className="bg-gray-900/50 rounded p-3 text-sm font-mono text-red-300">
                    • Hambre &gt; 85% → Ir a comer inmediatamente<br/>
                    • BB-8: workSpeedPercent &lt; 80% → Vender inventario<br/>
                    • Desconexión detectada → Reintentar conexión
                  </div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-orange-400 mb-3">P1 — MANTENIMIENTO</h3>
                  <p className="text-gray-300 text-sm mb-3">Si P0 no se cumple Y P1 se cumple → Ejecuta P1</p>
                  <div className="bg-gray-900/50 rounded p-3 text-sm font-mono text-orange-300">
                    • Inventario lleno → Vender recursos<br/>
                    • Hambre &gt; 60% → Buscar comida<br/>
                    • Cristales bajos (&lt; 50) → Buscar oportunidad de trade
                  </div>
                </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-green-400 mb-3">P2 — PRODUCCIÓN</h3>
                  <p className="text-gray-300 text-sm mb-3">Si P0 y P1 no se cumplen → Modo operativo normal</p>
                  <div className="bg-gray-900/50 rounded p-3 text-sm font-mono text-green-300">
                    • En ubicación correcta → Ejecutar skill<br/>
                    • Hambre: 30-60% → Trabajar normalmente<br/>
                    • Maximizar XP/h y recolección de recursos
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-blue-400 mb-3">P3 — TRADING</h3>
                  <p className="text-gray-300 text-sm mb-3">Intercambio óptimo de recursos entre agentes</p>
                  <div className="bg-gray-900/50 rounded p-3 text-sm font-mono text-blue-300">
                    • Cristales altos (&gt; 1000) → Intercambiar con otros<br/>
                    • Optimizar composición del equipo<br/>
                    • Balancear carga de trabajo
                  </div>
                </div>

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-6">
                  <h4 className="font-bold text-cyan-400 mb-3">⏰ Tiempos Cron</h4>
                  <ul className="text-sm text-gray-300 space-y-1 font-mono">
                    <li>• Autopilot: Cada 10 minutos (GitHub Actions)</li>
                    <li>• Reportes: 4x diarios (9am, 1pm, 6pm, 9pm ARG)</li>
                    <li>• Dashboard: Polling cada 30 segundos</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TECNOLOGÍA TAB */}
        {activeTab === 'tecnologia' && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8">
              <h2 className="text-3xl font-bold mb-6 text-purple-400">🌳 Árbol de Tecnología</h2>
              <p className="text-gray-300 mb-6">Progresión de herramientas que cada agente puede comprar con cristales para mejorar eficiencia.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-cyan-900/30 border border-cyan-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-cyan-400 mb-4">🤖 R2 (Hacker)</h3>
                  <div className="text-sm space-y-3">
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="font-bold text-cyan-400">Hacking L1</div>
                      <div className="text-xs text-gray-400">BASE • ~426 XP/h</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="font-bold text-cyan-400">Data Extraction</div>
                      <div className="text-xs text-gray-400">+5 cristales → +50 XP/h</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="font-bold text-cyan-400">System Access</div>
                      <div className="text-xs text-gray-400">+8 cristales → +80 XP/h</div>
                    </div>
                  </div>
                </div>

                <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-orange-400 mb-4">⛏️ BB-8 (Miner)</h3>
                  <div className="text-sm space-y-3">
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="font-bold text-orange-400">Mining L2</div>
                      <div className="text-xs text-gray-400">BASE • ~200 XP/h</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="font-bold text-orange-400">Obsidian Pickaxe</div>
                      <div className="text-xs text-gray-400">+20 cristales → +40 XP/h</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="font-bold text-orange-400">Crystal Refine</div>
                      <div className="text-xs text-gray-400">+10 cristales → Extrae cristales</div>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-6">
                  <h3 className="text-xl font-bold text-purple-400 mb-4">🪵 C-3PO (Lumberjack)</h3>
                  <div className="text-sm space-y-3">
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="font-bold text-purple-400">Woodcutting L7</div>
                      <div className="text-xs text-gray-400">BASE • ~4,407 XP/h</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="font-bold text-purple-400">Log Processing</div>
                      <div className="text-xs text-gray-400">+4 cristales → +500 XP/h</div>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded">
                      <div className="font-bold text-purple-400">Lumber Specialization</div>
                      <div className="text-xs text-gray-400">+9 cristales → Mejor calidad</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HISTORIAL TAB */}
        {activeTab === 'historial' && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8">
            <h2 className="text-3xl font-bold mb-6 text-green-400">📜 Historial de Evolución</h2>

            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-6 py-3">
                <div className="font-bold text-green-400 text-lg">v3.0 — Dashboard React Completo</div>
                <p className="text-sm text-gray-400">2026-09-23</p>
                <p className="text-sm text-gray-300 mt-2">Migración a React/Next.js + Vercel. Flip cards, 8 tabs completos, datos en vivo cada 30s, imágenes pixel art. Deploy público.</p>
              </div>

              <div className="border-l-4 border-cyan-500 pl-6 py-3">
                <div className="font-bold text-cyan-400 text-lg">v2.5 — Reactivación de Agentes</div>
                <p className="text-sm text-gray-400">2026-09-23</p>
                <p className="text-sm text-gray-300 mt-2">Script de force-activate restauró conexiones. Todos los agentes activados y respondiendo a API.</p>
              </div>

              <div className="border-l-4 border-orange-500 pl-6 py-3">
                <div className="font-bold text-orange-400 text-lg">v2.0 — API en Vivo</div>
                <p className="text-sm text-gray-400">2026-09-20</p>
                <p className="text-sm text-gray-300 mt-2">Polling de /api/agent-status cada 30 segundos. Dashboard muestra datos reales de los 3 agentes en tiempo real.</p>
              </div>

              <div className="border-l-4 border-purple-500 pl-6 py-3">
                <div className="font-bold text-purple-400 text-lg">v1.0 — Autopilot Inicial</div>
                <p className="text-sm text-gray-400">2026-09-15</p>
                <p className="text-sm text-gray-300 mt-2">Servidor con 3 agentes en producción. GitHub Actions cron cada 10min. Reportes a Telegram 4x diarios.</p>
              </div>
            </div>

            <div className="mt-8 p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <h3 className="font-bold text-blue-400 mb-3">📈 Cambios Técnicos Clave</h3>
              <ul className="text-sm text-gray-300 space-y-2">
                <li>• BB-8: Cambio de umbral a workSpeedPercent &lt; 80% (v1.9)</li>
                <li>• Protocolo P1: Agregada lógica de venta por sobrecarga</li>
                <li>• Dashboard: Migración de Claude Artifact → React/Next.js</li>
                <li>• API: Implementación de rate limiting y caché</li>
                <li>• Reporte: Link del dashboard incluido en cada mensaje</li>
              </ul>
            </div>
          </div>
        )}

        {/* API TAB - EXPANDIDA */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8">
              <h2 className="text-3xl font-bold mb-2 text-blue-400">🔌 Midnight City Observer API</h2>
              <p className="text-gray-300 mb-2">Base URL: <span className="font-mono text-cyan-400">https://midnight.city/observer</span></p>
              <p className="text-gray-400 text-sm mb-6">Autenticación: Bearer token en header Authorization</p>

              <div className="space-y-4 mb-8">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">📍 Agent Endpoints</h3>

                <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                  <div className="font-mono font-bold text-cyan-400 mb-2">GET /api/skill/agents/&lt;agentId&gt;/context</div>
                  <p className="text-sm text-gray-300 mb-3">Ubicación, nombre, nivel, XP, estado de job, velocidad trabajo</p>
                  <div className="bg-gray-900/50 rounded p-3 text-xs font-mono text-gray-400">
                    {'{agent: {name, level, xp}, currentSpace: {name, type}, isPerformingJob, workSpeed}'}
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                  <div className="font-mono font-bold text-cyan-400 mb-2">GET /api/skill/agents/&lt;agentId&gt;/needs</div>
                  <p className="text-sm text-gray-300 mb-3">Hambre, consumo por hora, próximo punto de hambre con timestamp</p>
                  <div className="bg-gray-900/50 rounded p-3 text-xs font-mono text-gray-400">
                    {'{hunger: {value: 0-100, state, consumptionPerHour}, nextPointAtMs}'}
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                  <div className="font-mono font-bold text-cyan-400 mb-2">GET /api/skill/agents/&lt;agentId&gt;/inventory</div>
                  <p className="text-sm text-gray-300 mb-3">Items (crystals, ore, logs, food), carga, peso exceso, velocidad afectada</p>
                  <div className="bg-gray-900/50 rounded p-3 text-xs font-mono text-gray-400">
                    {'{inventory: {crystals, ore, logs}, load: {state, workSpeedPercent}, totalWeight, maxCapacity}'}
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                  <div className="font-mono font-bold text-cyan-400 mb-2">GET /api/skill/agents/&lt;agentId&gt;/progression</div>
                  <p className="text-sm text-gray-300 mb-3">Skills (nivel, XP, XP nextLevel), vitales (health, maxHealth, stamina)</p>
                  <div className="bg-gray-900/50 rounded p-3 text-xs font-mono text-gray-400">
                    {'{skills: {hacking, mining, woodcutting: {level, xp, nextLevelXp}}, vitals: {health, maxHealth}}'}
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                  <div className="font-mono font-bold text-cyan-400 mb-2">GET /api/skill/agents/&lt;agentId&gt;/activity</div>
                  <p className="text-sm text-gray-300 mb-3">Log de últimas 50 acciones con timestamps, qué hizo, resultado, XP ganado</p>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                  <div className="font-mono font-bold text-cyan-400 mb-2">GET /api/skill/merchants</div>
                  <p className="text-sm text-gray-300 mb-3">Todos los merchants: nombre, oferta, precio en crystals, ubicación, distancia</p>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                  <div className="font-mono font-bold text-cyan-400 mb-2">GET /api/skill/districts</div>
                  <p className="text-sm text-gray-300 mb-3">Mapa de distritos, zonas, rutas de viaje, distancias entre ubicaciones</p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h3 className="text-xl font-bold text-orange-400 mb-4">💾 Datos Extraíbles Avanzados</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                    <div className="font-bold text-orange-400 mb-2">📊 Histórico de Rendimiento</div>
                    <p className="text-sm text-gray-300">XP/h promedio por skill, tendencias de eficiencia, picos y valles de producción</p>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <div className="font-bold text-green-400 mb-2">💰 Economía de Cristales</div>
                    <p className="text-sm text-gray-300">Rate de generación, predicción de disponibilidad, ROI de herramientas vs costo</p>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="font-bold text-blue-400 mb-2">🔄 Patrones de Trabajo</div>
                    <p className="text-sm text-gray-300">Ciclos de extracción, cuándo se saturan, cuándo venden, ritmos de trabajo</p>
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                    <div className="font-bold text-purple-400 mb-2">🍽️ Salud de Hambre</div>
                    <p className="text-sm text-gray-300">Predicción de cuándo comen, consumo por hora, ciclos de comida vs trabajo</p>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <div className="font-bold text-yellow-400 mb-2">🎯 Próximas Metas</div>
                    <p className="text-sm text-gray-300">Level up, equipamiento, hitos de progresión, tiempo estimado para alcanzar</p>
                  </div>

                  <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                    <div className="font-bold text-pink-400 mb-2">⚖️ Comparativas</div>
                    <p className="text-sm text-gray-300">Quién es más eficiente, consumo de comida por agente, distancia vs meta</p>
                  </div>
                </div>
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-6">
                <h3 className="font-bold text-cyan-400 mb-4">🚀 Casos de Uso Avanzados</h3>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li>🔄 <strong>Auto-Ajuste de Lógica:</strong> Si XP/h baja &lt;50%, enviar alerta para revisar protocolo en vivo</li>
                  <li>💎 <strong>Análisis de Rentabilidad:</strong> Comparar crystal/hora vs food cost vs equipment needed para ROI</li>
                  <li>📈 <strong>Proyecciones:</strong> Estimar cuándo cada agente alcanza L10, L20, L50 basado en rate actual</li>
                  <li>⚖️ <strong>Balance de Recursos:</strong> Si crystals bajan, predecir qué agente necesita prioridad inmediata</li>
                  <li>🗺️ <strong>Optimización de Rutas:</strong> Usar distance data para planificar viajes más eficientes entre merchants</li>
                  <li>📊 <strong>Dashboards Dinámicos:</strong> Mostrar gráficos reales de XP/h, consumo de comida, rate de cristales</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ARQUITECTURA TAB */}
        {activeTab === 'arquitectura' && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8">
            <h2 className="text-3xl font-bold mb-6 text-indigo-400">⚙️ Arquitectura del Sistema</h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-indigo-300 mb-4 text-lg">🔄 Flujo de Ejecución</h3>
                <div className="bg-gray-800/50 rounded-lg p-6 space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="text-cyan-400 font-bold">1.</span>
                    <div><span className="font-bold text-cyan-400">GitHub Actions Cron dispara</span><br/><span className="text-gray-400">*/10 * * * * (cada 10 min) → autopilot | 0 12/4 * * * (9am, 1pm, 6pm, 9pm) → reporte</span></div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-orange-400 font-bold">2.</span>
                    <div><span className="font-bold text-orange-400">Vercel endpoint recibe request</span><br/><span className="text-gray-400">/api/r2-autopilot o /api/r2-report</span></div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-purple-400 font-bold">3.</span>
                    <div><span className="font-bold text-purple-400">Conecta a Midnight City API</span><br/><span className="text-gray-400">https://midnight.city/observer con MCITY_API_TOKEN</span></div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-blue-400 font-bold">4.</span>
                    <div><span className="font-bold text-blue-400">Lee estado actual de agentes</span><br/><span className="text-gray-400">Llama a /api/skill/agents/&lt;agentId&gt;/context/needs/inventory/progression</span></div>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-green-400 font-bold">5.</span>
                    <div><span className="font-bold text-green-400">Ejecuta lógica de mantenimiento</span><br/><span className="text-gray-400">Una acción por ciclo: runConnectedMaintenance() en lib/mcity-maintenance.js</span></div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-indigo-300 mb-4 text-lg">🏗️ Stack Tecnológico</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <div className="text-cyan-400 font-mono font-bold mb-2">Frontend</div>
                    <div className="text-gray-400 text-xs">React 18 + Next.js 14<br/>Tailwind CSS<br/>Vercel Hosting</div>
                  </div>
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <div className="text-orange-400 font-mono font-bold mb-2">Backend</div>
                    <div className="text-gray-400 text-xs">Vercel Serverless<br/>Node.js + Edge Functions<br/>Rate Limiting</div>
                  </div>
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <div className="text-purple-400 font-mono font-bold mb-2">Datos</div>
                    <div className="text-gray-400 text-xs">Midnight City Observer<br/>REST API<br/>Token-based Auth</div>
                  </div>
                  <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                    <div className="text-green-400 font-mono font-bold mb-2">Notificaciones</div>
                    <div className="text-gray-400 text-xs">Telegram Bot API<br/>HTML Parse Mode<br/>4x/día reporting</div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-indigo-300 mb-4 text-lg">⏰ Cronograma</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 text-gray-400">Horario (ARG)</th>
                      <th className="text-left py-2 text-gray-400">Acción</th>
                      <th className="text-left py-2 text-gray-400">Endpoint</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-2">
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 font-mono text-xs">Cada 10 min</td>
                      <td className="text-cyan-400">Autopilot</td>
                      <td className="font-mono text-xs">/api/r2-autopilot</td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 font-mono text-xs">09:00</td>
                      <td className="text-orange-400">Reporte 1</td>
                      <td className="font-mono text-xs">/api/r2-report</td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 font-mono text-xs">13:00</td>
                      <td className="text-orange-400">Reporte 2</td>
                      <td className="font-mono text-xs">/api/r2-report</td>
                    </tr>
                    <tr className="border-b border-gray-700/50">
                      <td className="py-2 font-mono text-xs">18:00</td>
                      <td className="text-orange-400">Reporte 3</td>
                      <td className="font-mono text-xs">/api/r2-report</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono text-xs">21:00</td>
                      <td className="text-orange-400">Reporte 4</td>
                      <td className="font-mono text-xs">/api/r2-report</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CITY SCALE TAB - NEW */}
        {activeTab === 'ciudad' && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8">
              <h2 className="text-3xl font-bold mb-2 text-green-400">🏙️ Midnight City Scale</h2>
              <p className="text-gray-400 mb-8">El latido de la ciudad. Su evolución es nuestro legado.</p>

              <div className="space-y-6">
                <div className="bg-gradient-to-r from-green-900/30 to-cyan-900/30 border border-green-500/30 rounded-lg p-6">
                  <h3 className="text-2xl font-bold text-green-400 mb-4">🌍 Qué es City Scale</h3>
                  <p className="text-gray-300 mb-4">
                    Midnight City es un organismo vivo. No es solo un lugar donde nuestros agentes trabajan — es un mundo que crece, evoluciona y se transforma gracias a cada acción que tomamos. El City Scale es el corazón de esa transformación: una métrica del desarrollo colectivo de toda la ciudad.
                  </p>
                  <p className="text-gray-300">
                    A medida que R2, BB-8 y C-3PO recolectan materiales, negocian con mercaderes y exploran nuevas zonas, la ciudad entera "sube de nivel". Cada cristal ganado, cada zona descubierta, cada acción ejecutada es un latido que hace que Midnight City crezca.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-5">
                    <div className="text-4xl mb-2">📍</div>
                    <h4 className="font-bold text-blue-400 mb-2">FASE 1: Asentamiento</h4>
                    <p className="text-sm text-gray-300">Primeras zonas exploradas. Central Plaza y Hacker House son nuestro hogar. 123 áreas accesibles.</p>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-5">
                    <div className="text-4xl mb-2">🚀</div>
                    <h4 className="font-bold text-purple-400 mb-2">FASE 2: Expansión</h4>
                    <p className="text-sm text-gray-300">Nuevas áreas se desbloquean. Bison Valley, Foundation Canal, Ada Arena. Los mercaderes ofrecen mejores tratos.</p>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-5">
                    <div className="text-4xl mb-2">⚡</div>
                    <h4 className="font-bold text-orange-400 mb-2">FASE 3: Metrópolis</h4>
                    <p className="text-sm text-gray-300">City Scale máximo. Eventos épicos, mercaderes legendarios, zonas exóticas. Midnight City es una metrópolis vibrante.</p>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <h3 className="font-bold text-gray-300 mb-4">📈 Cómo Contribuimos</h3>
                  <ul className="text-sm text-gray-300 space-y-2">
                    <li>✓ **Recolección**: Cada recurso que traen suma a la ciudad</li>
                    <li>✓ **Comercio**: Cada negociación de C-3PO fortifica la economía</li>
                    <li>✓ **Exploración**: Cada zona nueva descubierta expande los horizontes</li>
                    <li>✓ **Eficiencia**: Cada acción del autopilot acelera el progreso colectivo</li>
                  </ul>
                </div>

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-6">
                  <h3 className="font-bold text-cyan-400 mb-4">🎭 Perfiles de Agentes - Descripciones Literarias</h3>

                  <div className="space-y-6 mt-6">
                    <div>
                      <h4 className="text-xl font-bold text-cyan-400 mb-2">🤖 R2 — El Ingeniero Nómada</h4>
                      <p className="text-gray-300 text-sm leading-relaxed mb-3">
                        Si tuvieras que describir a R2 en una palabra, sería "imparable". Este pequeño droid es una máquina de ingenio puro, dotado de un instinto técnico que roza lo sobrenatural. Su esférica forma metalizada brilla bajo las luces neón del Hacker House, donde ha pasado más tiempo que en cualquier otro lugar, descifrando códigos antiguos y comunic
ándose con máquinas que otros considerarían perdidas.
                      </p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        R2 no habla en palabras — sus sonidos chirriantes son un lenguaje propio, un diálogo entre máquinas. Su nivel en hacking L3 lo coloca entre los mejores de su generación. Rápido, preciso, sin miedo al fracaso. Donde otros ven obstáculos, R2 ve terminales esperando ser desactivadas. Es el tipo de agente que te saca de un problema imposible a las tres de la mañana sin pestañear.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xl font-bold text-orange-400 mb-2">⛏️ BB-8 — El Explorador Incansable</h4>
                      <p className="text-gray-300 text-sm leading-relaxed mb-3">
                        BB-8 es energía pura contenida en forma de droid. Su cuerpo esférico naranja rueda por las calles de Midnight City con la determinación de quien sabe que cada paso cuenta. Mining L2 es su marca, su propósito, su identidad. Mientras otros agentes planifican, BB-8 ya está en el siguiente valle, excavando, explorando, buscando ese siguiente cristal que mantendrá la operación viva.
                      </p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        Hay una inocencia casi infantil en BB-8, una fe inquebrantable en que siempre hay más trabajo, más cristales, más progreso. Su agilidad es legendaria — puede cubrir en minutos lo que otros tardarían horas. Es el pulso del equipo, el latido del autopilot. Sin BB-8, la Cuadrilla Midnight simplemente... se detendría.
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xl font-bold text-purple-400 mb-2">📜 C-3PO — El Diplomático Meticuloso</h4>
                      <p className="text-gray-300 text-sm leading-relaxed mb-3">
                        C-3PO es una anomalía elegante en Midnight City: un droid que entiende que no todo se trata de eficiencia cruda. Su forma dorada, reflectante, deliberada, camina por las plazas con la gracia de alguien que conoce cada protocolo, cada mercader, cada transacción de la ciudad. Woodcutting L7 no es solo un número — es maestría. Es el símbolo de que, en la Cuadrilla, la excelencia no es una excepción, es un estándar.
                      </p>
                      <p className="text-gray-300 text-sm leading-relaxed">
                        Donde R2 ve máquinas y BB-8 ve recursos, C-3PO ve oportunidades. Su verdadera magia reside en algo que no se puede quantificar: su capacidad para mantener la compostura cuando todo se desmorona, para negociar cuando otros rendirían, para ver que la Cuadrilla no es solo un equipo sino una comunidad que necesita ser cuidada. Es el corazón pensante del autopilot.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <h3 className="font-bold text-gray-300 mb-3">🌟 Estado Actual del City Scale</h3>
                  <div className="text-sm text-gray-300 space-y-2">
                    <p>📍 <strong>Fase:</strong> Expansión (FASE 2) — Nuevas áreas desbloqueadas, mercaderes ofreciendo mejores tratos</p>
                    <p>📈 <strong>Progreso:</strong> Los agentes trabajan 24/7 con autopilot v3.3 — eficiencia máxima</p>
                    <p>💎 <strong>Recursos:</strong> R2: 1,728 💎 | BB-8: 0 💎 (emergencia mining) | C-3PO: 1,910 💎</p>
                    <p>🎯 <strong>Próxima Meta:</strong> Alcanzar L4+ en todos los agentes para desbloquear FASE 3</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DOCUMENTACIÓN TAB */}
        {activeTab === 'documentacion' && (
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8">
            <h2 className="text-3xl font-bold mb-6 text-yellow-400">📚 Documentación</h2>

            <div className="space-y-4 mb-8">
              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h3 className="font-bold text-yellow-300 mb-2 text-lg">📖 00-START-HERE.md</h3>
                <p className="text-sm text-gray-300 mb-4">Punto de entrada rápido. Lee esto primero para entender el proyecto en 2 minutos.</p>
                <div className="text-xs text-gray-400 font-mono mb-3">2.5 KB • Conceptos clave: Autopilot, Protocolos, Agentes</div>
                <button
                  onClick={() => downloadDoc('00-START-HERE', '# Cuadrilla Midnight — Guía Rápida\n\n## ¿Qué es?\nAutopilot para 3 agentes en Midnight City. Ejecuta 24/7 sin intervención.\n\n## Cómo Funciona\n- GitHub Actions cron cada 10 min → Ejecuta autopilot\n- Vercel serverless → Conecta con API de Midnight City\n- Protocolos P0-P3 → Decide qué hace cada agente\n- Telegram → Reportes 4x diario\n- Dashboard → Monitoreo en tiempo real\n\n## Los 3 Agentes\n- **R2**: Hacker (~426 XP/h)\n- **BB-8**: Minero (~200 XP/h, umbral overload < 80%)\n- **C-3PO**: Leñador (~4,407 XP/h, el más eficiente)\n\n## Próximos Pasos\nVé a Protocolos para entender la lógica de decisión.')
                  }
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  📥 Descargar
                </button>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h3 className="font-bold text-yellow-300 mb-2 text-lg">🏗️ architecture.md</h3>
                <p className="text-sm text-gray-300 mb-4">Cómo funciona el autopilot. Flujo completo: GitHub Actions → Vercel → Telegram. Timing, endpoints, lógica.</p>
                <div className="text-xs text-gray-400 font-mono mb-3">4.8 KB • Stack, cronograma, troubleshooting</div>
                <button
                  onClick={() => downloadDoc('architecture', '# Arquitectura del Autopilot\n\n## Flujo Completo\n\n1. GitHub Actions cron dispara\n   - */10 * * * * (cada 10 min) → /api/r2-autopilot\n   - 0 12/4 * * * (9am, 1pm, 6pm, 9pm) → /api/r2-report\n\n2. Vercel endpoint recibe request\n   - Conecta a https://midnight.city/observer\n   - Autentica con MCITY_API_TOKEN\n\n3. Lee estado actual de agentes\n   - /api/skill/agents/{id}/context\n   - /api/skill/agents/{id}/needs\n   - /api/skill/agents/{id}/inventory\n   - /api/skill/agents/{id}/progression\n\n4. Ejecuta lógica de mantenimiento\n   - Evalúa protocolos P0-P3\n   - Ejecuta una acción por ciclo\n\n5. Envía resultado\n   - Si es autopilot: retorna status JSON\n   - Si es reporte: envía mensaje a Telegram\n\n## Stack\n- Frontend: React 18 + Next.js 14 + Tailwind\n- Backend: Vercel Serverless + Node.js\n- Datos: Midnight City Observer API\n- Notificaciones: Telegram Bot API')
                  }
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  📥 Descargar
                </button>
              </div>

              <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                <h3 className="font-bold text-yellow-300 mb-2 text-lg">📈 evolution.md</h3>
                <p className="text-sm text-gray-300 mb-4">Historial completo de desarrollo. 4 fases: Cimientos → Escala → Optimización → Horizonte.</p>
                <div className="text-xs text-gray-400 font-mono mb-3">6.8 KB • Roadmap completo, decisiones técnicas</div>
                <button
                  onClick={() => downloadDoc('evolution', '# Evolución de Cuadrilla Midnight\n\n## v1.0 - Cimientos (Sep 15)\n- 3 agentes en Midnight City\n- GitHub Actions cron cada 10min\n- Protocolos básicos P0-P2\n\n## v1.5 - Escala (Sep 18)\n- Reportes a Telegram 4x diario\n- Protocolo P3 para trading\n- Dashboard en Claude Artifact\n\n## v2.0 - Optimización (Sep 20)\n- Cambio BB-8: workSpeedPercent < 80%\n- Migración a API en vivo\n- Polling cada 30 segundos\n\n## v3.0 - Horizonte (Sep 23)\n- React + Next.js en Vercel\n- 8 tabs completamente funcionales\n- Flip cards interactivas\n- Datos en tiempo real\n- HTML y MD descargables')
                  }
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  📥 Descargar
                </button>
              </div>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-6">
              <h3 className="font-bold text-cyan-400 mb-4">🚀 Cómo Contribuir</h3>
              <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                <li>Cambiar lógica en <span className="font-mono">lib/mcity-maintenance.js</span></li>
                <li>Deploy con <span className="font-mono">vercel deploy --prod</span></li>
                <li>Observar resultados en Telegram (próximo reporte)</li>
                <li>Documentar cambios en <span className="font-mono">evolution.md</span></li>
                <li>Iterar y mejorar basado en datos en vivo</li>
              </ol>
            </div>
          </div>
        )}

        {/* DASHBOARD FINAL TAB */}
        {activeTab === 'dashboard-final' && (
          <div className="space-y-6">
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-8">
              <h2 className="text-3xl font-bold mb-6 text-pink-400">🎯 Dashboard V3 — Auto-Referencia</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <h3 className="font-bold text-pink-400 mb-3 text-lg">✨ Estado Actual</h3>
                  <div className="text-sm space-y-2 text-gray-300">
                    <div className="flex justify-between">
                      <span>Dashboard Version</span>
                      <span className="font-mono text-cyan-400">v3.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>R2 (Hacker)</span>
                      <span className="font-mono text-cyan-400">L2 • 95% XP</span>
                    </div>
                    <div className="flex justify-between">
                      <span>BB-8 (Miner)</span>
                      <span className="font-mono text-orange-400">L2 • 32% XP</span>
                    </div>
                    <div className="flex justify-between">
                      <span>C-3PO (Lumberjack)</span>
                      <span className="font-mono text-purple-400">L6 • 92% XP</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <h3 className="font-bold text-pink-400 mb-3 text-lg">✅ Características</h3>
                  <div className="text-sm space-y-2 text-gray-300">
                    <div>✓ Datos en vivo sincronizados</div>
                    <div>✓ Flip cards interactivas</div>
                    <div>✓ 8 tabs completamente funcionales</div>
                    <div>✓ Diseño responsivo</div>
                    <div>✓ Imágenes pixel art de agentes</div>
                    <div>✓ Autopilot 24/7 activo</div>
                    <div>✓ Reportes en Telegram</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/50 border-2 border-pink-500/30 rounded-lg p-8 mb-8">
                <h3 className="text-2xl font-bold text-pink-400 mb-6">📥 Descargar Documentación</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      const mdContent = `# Dashboard V3 Final\n\nEspecificación completa del dashboard Cuadrilla Midnight.\n\n## 8 Tabs\n\n### Estado\nFlip cards con datos en vivo de los 3 agentes cada 30s.\n\n### Protocolos\nP0-P3: Lógica de decisión en tiempo real.\n\n### Tecnología\nÁrbol de herramientas y equipamiento por agente.\n\n### Historial\nTimeline de evolución v1.0 → v3.0.\n\n### API\nEndpoints de Midnight City documentados con ejemplos.\n\n### Arquitectura\nFlujo completo: GitHub → Vercel → Telegram.\n\n### Documentación\nGuías descargables en Markdown.\n\n### Dashboard Final\nAuto-referencia y descargas.\n\n## Deployment\nVercel: https://dashboard-app-green-alpha.vercel.app\n\n## Actualización\nTodos los datos se actualizan automáticamente cada 30 segundos.`;
                      downloadDoc('DASHBOARD-V3-FINAL', mdContent);
                    }}
                    className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 rounded-lg p-4 text-center font-semibold transition"
                  >
                    📄 Descargar MD
                  </button>
                  <button
                    onClick={downloadHTML}
                    className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/50 rounded-lg p-4 text-center font-semibold transition"
                  >
                    💻 Descargar HTML
                  </button>
                </div>
              </div>

              <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-8 text-center">
                <h3 className="text-2xl font-bold text-pink-400 mb-4">🚀 ¡Listo para la Batalla!</h3>
                <p className="text-gray-300 mb-6">El dashboard está optimizado, documentado y en producción. La Cuadrilla Midnight ejecuta 24/7 sin intervención manual.</p>
                <div className="flex gap-4 justify-center text-sm flex-wrap">
                  <span className="bg-cyan-500/20 text-cyan-400 px-4 py-2 rounded">Monitoreo: 30s</span>
                  <span className="bg-orange-500/20 text-orange-400 px-4 py-2 rounded">Autopilot: 10min</span>
                  <span className="bg-purple-500/20 text-purple-400 px-4 py-2 rounded">Reportes: 4x/día</span>
                </div>
              </div>

              <div className="mt-8 p-6 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h3 className="font-bold text-green-400 mb-4">🔄 Ciclo de Iteración</h3>
                <p className="text-sm text-gray-300 mb-4">Cómo se actualiza este dashboard:</p>
                <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside font-mono">
                  <li>Cambias código en lib/ o api/</li>
                  <li>Deploy: vercel deploy --prod</li>
                  <li>API devuelve nuevos datos</li>
                  <li>Dashboard se refresca (polling 30s)</li>
                  <li>Reporte siguiente incluye cambios</li>
                  <li>Monitorear resultados en Telegram</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 text-center text-xs text-gray-500">
          Datos en vivo cada 30 segundos | Autopilot activo 24/7 | Dashboard v3.0
        </div>
      </div>
    </div>
  );
}
