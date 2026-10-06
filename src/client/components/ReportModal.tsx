import { motion } from "framer-motion";
import { Brain, Loader2, ShieldAlert } from "lucide-react";
import type { FinalReport } from "../../lib/types";

const scoreColor = (score: number) =>
  score >= 80
    ? "text-green-400"
    : score >= 60
      ? "text-amber-400"
      : "text-red-400";

export function ReportModal({
  report,
  progress,
  endedReason,
  onDone
}: {
  report: FinalReport | null;
  progress: string | null;
  endedReason: "manual" | "timeout" | null;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 to-blue-600" />

        {!report ? (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <h2 className="text-xl font-bold text-white">
              {endedReason === "timeout"
                ? "Session ended after inactivity"
                : "Wrapping up your interview"}
            </h2>
            <p className="text-slate-400 text-sm">
              {progress ?? "Starting the report workflow"}…
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">
                Interview complete
              </h2>
              <p className="text-slate-400 text-sm">
                {report.turnCount} answers · live score{" "}
                {report.averageTurnScore ?? "—"} · final evaluation{" "}
                {report.llmScore}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4 text-center border border-white/5">
                <p className="text-slate-400 text-xs uppercase font-bold mb-1">
                  Score
                </p>
                <p className={`text-4xl font-bold ${scoreColor(report.score)}`}>
                  {report.score}%
                </p>
              </div>
              <div className="sm:col-span-2 bg-white/5 rounded-xl p-4 border border-white/5">
                <p className="text-slate-400 text-xs uppercase font-bold mb-2">
                  Summary
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {report.summary}
                </p>
              </div>
            </div>

            {report.integrityFlag && (
              <div className="mb-6 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex gap-2 items-start">
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                Several answers looked read or AI-assisted (risk{" "}
                {report.integrityRisk}%), so the score was capped at 50.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <Pills title="Strengths" items={report.strengths} tone="green" />
              <Pills title="Improve" items={report.weaknesses} tone="red" />
            </div>

            {report.memoriesSaved > 0 && (
              <p className="mb-6 text-xs text-violet-300 flex items-center gap-2">
                <Brain className="w-4 h-4" /> {report.memoriesSaved} new
                memories saved for your next session.
              </p>
            )}

            <button
              onClick={onDone}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-cyan-500/20"
            >
              Back to dashboard
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function Pills({
  title,
  items,
  tone
}: {
  title: string;
  items: string[];
  tone: "green" | "red";
}) {
  const styles =
    tone === "green"
      ? "bg-green-500/10 text-green-300 border-green-500/20"
      : "bg-red-500/10 text-red-300 border-red-500/20";
  return (
    <div>
      <h3
        className={`font-bold text-sm mb-3 uppercase ${tone === "green" ? "text-green-400" : "text-red-400"}`}
      >
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={i}
            className={`px-3 py-1 text-xs rounded-full border ${styles}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
