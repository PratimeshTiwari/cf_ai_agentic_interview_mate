import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAgent } from "agents/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Calendar,
  ChevronRight,
  History,
  LogOut,
  Play,
  ShieldCheck,
  Trash2,
  TrendingUp
} from "lucide-react";
import type { UserAgent } from "../../agents/user";
import { INITIAL_USER_STATE, type UserState } from "../../lib/types";
import { CoachChat } from "../components/CoachChat";
import { useLastDefined } from "../hooks/useLastDefined";
import {
  clearCurrentUser,
  getCurrentUser,
  type DemoUser
} from "../lib/session";

const scoreColor = (score: number) =>
  score >= 80
    ? "text-green-400"
    : score >= 60
      ? "text-amber-400"
      : "text-red-400";

const memoryColor: Record<string, string> = {
  skill: "text-cyan-400",
  experience: "text-blue-400",
  preference: "text-violet-400",
  weakness: "text-amber-400",
  fact: "text-slate-400"
};

export function DashboardPage() {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: DemoUser }) {
  const navigate = useNavigate();
  const agent = useAgent<UserAgent, UserState>({
    agent: "UserAgent",
    name: user.id
  });
  const state = useLastDefined(agent.state) ?? INITIAL_USER_STATE;
  const [expanded, setExpanded] = useState<string | null>(null);

  // Register the persona's profile with its UserAgent on first connect.
  useEffect(() => {
    if (!agent.state || agent.state.profile?.id === user.id) return;
    agent.stub
      .setProfile({ id: user.id, name: user.name, role: user.role })
      .catch(console.error);
  }, [agent, agent.state, user]);

  const stats = useMemo(() => {
    const scores = state.sessions.map((s) => s.score);
    const avg = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
    const best = scores.length ? Math.max(...scores) : null;
    const trend =
      scores.length >= 2 ? scores[0] - scores[scores.length - 1] : null;
    return { avg, best, trend };
  }, [state.sessions]);

  const weakAreas = useMemo(
    () => state.memories.filter((m) => m.type === "weakness").slice(0, 4),
    [state.memories]
  );

  return (
    <main className="min-h-screen p-4 sm:p-8 relative overflow-x-hidden bg-slate-950">
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full ${user.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
            >
              {user.initials}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Hello, {user.name}
              </h1>
              <p className="text-slate-400 text-sm">
                Practising for {user.role} roles
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              clearCurrentUser();
              navigate("/login");
            }}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
            aria-label="Switch persona"
            title="Switch persona"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: start + stats */}
          <div className="space-y-6">
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(`/interview/${crypto.randomUUID()}`)}
              className="w-full text-left bg-gradient-to-br from-cyan-500 to-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-cyan-500/20 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-10 -translate-y-10" />
              <h2 className="text-xl font-bold mb-2">Start a new interview</h2>
              <p className="text-cyan-100 text-sm mb-6 opacity-90">
                Ava adapts to your resume, the job description and what she
                remembers about you.
              </p>
              <span className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold flex items-center justify-center gap-2">
                <Play className="w-4 h-4 fill-current" /> Start session
              </span>
            </motion.button>

            <div className="grid grid-cols-2 gap-4">
              <Stat
                icon={<TrendingUp className="w-4 h-4" />}
                label="Avg score"
                value={stats.avg === null ? "—" : `${stats.avg}%`}
              />
              <Stat
                icon={<History className="w-4 h-4" />}
                label="Sessions"
                value={String(state.sessions.length)}
              />
              <Stat
                icon={<ShieldCheck className="w-4 h-4" />}
                label="Best"
                value={stats.best === null ? "—" : `${stats.best}%`}
              />
              <Stat
                icon={<TrendingUp className="w-4 h-4" />}
                label="Trend"
                value={
                  stats.trend === null
                    ? "—"
                    : `${stats.trend >= 0 ? "+" : ""}${stats.trend}`
                }
              />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <h3 className="text-white font-bold mb-4">Focus areas</h3>
              {weakAreas.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Weak spots Ava notices will show up here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {weakAreas.map((m) => (
                    <li
                      key={m.id}
                      className="text-sm text-amber-200/90 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2"
                    >
                      {m.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Middle: memory bank */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col md:h-[640px]"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/20 rounded-lg">
                  <Brain className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Memory bank</h2>
                  <p className="text-xs text-slate-400">
                    What Ava remembers about you
                  </p>
                </div>
              </div>
              {state.memories.length > 0 && (
                <button
                  onClick={() =>
                    agent.stub.clearMemories().catch(console.error)
                  }
                  className="p-2 text-slate-500 hover:text-red-400"
                  aria-label="Forget all memories"
                  title="Forget all memories"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin">
              {state.memories.length === 0 && (
                <p className="text-slate-500 text-xs text-center italic mt-10">
                  No memories yet. Finish an interview and Ava will remember
                  what she learned.
                </p>
              )}
              {state.memories.map((m) => (
                <div
                  key={m.id}
                  className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-violet-500/30 transition-colors"
                >
                  <p className="text-sm text-slate-300">{m.text}</p>
                  <span
                    className={`text-[10px] uppercase tracking-wider mt-2 block ${memoryColor[m.type] ?? "text-slate-500"}`}
                  >
                    {m.type} · {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: history */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6 md:h-[640px] flex flex-col"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Recent sessions
                </h2>
                <p className="text-xs text-slate-400">Your practice history</p>
              </div>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin">
              {state.sessions.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">
                  No interviews yet.
                </p>
              )}
              {state.sessions.map((s) => {
                const isOpen = expanded === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className={`w-full text-left p-4 bg-white/5 rounded-xl border transition-all ${isOpen ? "border-cyan-500/50 bg-white/10" : "border-white/5 hover:bg-white/10"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-medium text-sm">
                          {s.role}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {new Date(s.createdAt).toLocaleDateString()} ·{" "}
                          {s.turnCount} answers
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-lg font-bold ${scoreColor(s.score)}`}
                        >
                          {s.score}%
                        </span>
                        <ChevronRight
                          className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                      </div>
                    </div>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                            <p className="text-sm text-slate-300 leading-relaxed">
                              {s.summary}
                            </p>
                            <Tags items={s.strengths} tone="green" />
                            <Tags items={s.weaknesses} tone="red" />
                            {s.integrityRisk > 70 && (
                              <p className="text-xs text-red-400">
                                Integrity risk {s.integrityRisk}%
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>

      <CoachChat agent={agent} />
    </main>
  );
}

function Stat({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-xs uppercase font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Tags({ items, tone }: { items: string[]; tone: "green" | "red" }) {
  if (items.length === 0) return null;
  const styles =
    tone === "green"
      ? "bg-green-500/10 text-green-300 border-green-500/20"
      : "bg-red-500/10 text-red-300 border-red-500/20";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span
          key={i}
          className={`px-2 py-1 text-xs rounded-md border ${styles}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}
