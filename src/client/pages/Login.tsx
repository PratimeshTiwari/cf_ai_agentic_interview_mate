import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { DEMO_USERS, setCurrentUser } from "../lib/session";

export function LoginPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const handleContinue = () => {
    const user = DEMO_USERS.find((u) => u.id === selected);
    if (!user) return;
    setCurrentUser(user);
    navigate("/dashboard");
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-500/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-500/20 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl z-10"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Agentic Interview Mate
          </h1>
          <p className="text-slate-400 text-sm">
            Pick a demo persona. Each one has its own history and memory.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {DEMO_USERS.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelected(user.id)}
              className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 group ${
                selected === user.id
                  ? "bg-white/10 border-cyan-500/50 shadow-lg shadow-cyan-500/10"
                  : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full ${user.color} flex items-center justify-center text-white font-bold text-sm shadow-lg`}
              >
                {user.initials}
              </div>
              <div className="text-left flex-1">
                <h3 className="text-white font-medium group-hover:text-cyan-400 transition-colors">
                  {user.name}
                </h3>
                <p className="text-xs text-slate-400">{user.role}</p>
              </div>
              {selected === user.id && (
                <div className="w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={handleContinue}
          disabled={!selected}
          className={`w-full py-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            selected
              ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/25"
              : "bg-slate-800 text-slate-500 cursor-not-allowed"
          }`}
        >
          Continue <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-center mt-6 text-xs text-slate-500">
          Demo sign-in · no password, no account
        </p>
      </motion.div>
    </main>
  );
}
