import { motion } from "framer-motion";
import { Activity, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { TurnLog } from "../../lib/types";

const qualityStyle: Record<string, string> = {
  Strong: "bg-green-500/10 border-green-500/20 text-green-400",
  Adequate: "bg-sky-500/10 border-sky-500/20 text-sky-400",
  Weak: "bg-amber-500/10 border-amber-500/20 text-amber-400",
  Irrelevant: "bg-slate-500/10 border-slate-500/20 text-slate-400",
  "AI-Suspected": "bg-red-500/10 border-red-500/20 text-red-400"
};

/**
 * Live view of the agent's silent per-turn analysis. Rendered straight
 * from InterviewAgent state, so it survives reloads and multiple tabs.
 */
export function AgentLog({
  turns,
  analyzing,
  phase,
  isOpen,
  toggle
}: {
  turns: TurnLog[];
  analyzing: boolean;
  phase: string;
  isOpen: boolean;
  toggle: () => void;
}) {
  const latest = turns.at(-1);
  return (
    <>
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -340 }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-black/90 backdrop-blur-xl border-r border-white/10 z-40 flex flex-col font-mono text-xs shadow-2xl"
      >
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-cyan-400 tracking-widest">
              AGENT_LOG
            </span>
          </div>
          <button
            onClick={toggle}
            className="text-slate-400 hover:text-white"
            aria-label="Hide agent log"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/10 grid grid-cols-2 gap-2">
          <div>
            <div className="text-[9px] uppercase text-slate-500">Phase</div>
            <div className="text-cyan-300 font-bold">{phase}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase text-slate-500">
              Running score
            </div>
            <div className="text-white font-bold">
              {latest ? latest.current_score : "—"}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          {analyzing && (
            <div className="flex items-center gap-2 text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" /> analyzing latest
              answer…
            </div>
          )}
          {turns.length === 0 && !analyzing && (
            <p className="text-slate-500 italic">
              Analysis appears here after each answer.
            </p>
          )}
          {[...turns].reverse().map((log) => (
            <div
              key={log.turn}
              className="border-l-2 border-white/10 pl-3 py-2 space-y-2 relative group"
            >
              <div className="absolute -left-[5px] top-3 w-2 h-2 rounded-full bg-cyan-500/50 group-hover:bg-cyan-400 transition-colors" />
              <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-wider">
                <span>
                  #{log.turn} · {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-cyan-500 font-bold">{log.phase}</span>
              </div>

              {log.behavior_log && (
                <div className="bg-white/5 p-2 rounded border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase block mb-1">
                    Behavior · {log.user_persona}
                  </span>
                  <p className="text-slate-300 italic leading-relaxed">
                    "{log.behavior_log}"
                  </p>
                </div>
              )}

              <div className="text-slate-400">
                <span className="text-violet-400 font-bold">REASONING:</span>{" "}
                {log.reasoning}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <div
                  className={`p-2 rounded border ${qualityStyle[log.answer_quality] ?? qualityStyle.Adequate}`}
                >
                  <div className="text-[9px] uppercase opacity-70">Quality</div>
                  <div className="font-bold">{log.answer_quality}</div>
                </div>
                <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <div className="text-[9px] uppercase opacity-70">Score</div>
                  <div className="font-bold">{log.current_score}</div>
                </div>
                <div
                  className={`col-span-2 p-2 rounded border flex justify-between items-center ${
                    log.plagiarism_score > 70
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : "bg-slate-800 border-white/10 text-slate-400"
                  }`}
                >
                  <div>
                    <div className="text-[9px] uppercase opacity-70">
                      Integrity risk
                    </div>
                    <div className="font-bold">{log.plagiarism_score}%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] uppercase opacity-70">
                      Session risk
                    </div>
                    <div className="font-bold">
                      {log.session_plagiarism_score}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.aside>

      {!isOpen && (
        <button
          onClick={toggle}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40 p-2 rounded-r-lg bg-white/10 border border-l-0 border-white/10 text-cyan-400 hover:bg-white/20"
          aria-label="Show agent log"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
