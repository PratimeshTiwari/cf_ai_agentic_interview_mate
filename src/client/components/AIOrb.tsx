import { motion } from "framer-motion";
import { Brain } from "lucide-react";

export function AIOrb({
  isSpeaking,
  isThinking
}: {
  isSpeaking: boolean;
  isThinking: boolean;
}) {
  return (
    <div className="relative flex items-center justify-center w-56 h-56 sm:w-64 sm:h-64">
      <motion.div
        animate={{
          scale: isSpeaking ? [1, 1.2, 1] : isThinking ? [1, 1.1, 1] : 1,
          opacity: isSpeaking ? 1 : 0.8
        }}
        transition={{
          duration: isSpeaking ? 0.5 : 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className={`w-32 h-32 rounded-full blur-xl ${
          isThinking ? "bg-amber-500" : "bg-cyan-500"
        }`}
      />
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-48 h-48 rounded-full border border-white/10 border-t-cyan-500/50"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute w-56 h-56 rounded-full border border-white/5 border-b-violet-500/30"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-24 h-24 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl ${
            isSpeaking ? "shadow-cyan-500/50" : ""
          }`}
        >
          <Brain
            className={`w-10 h-10 ${isThinking ? "text-amber-400" : "text-cyan-400"}`}
          />
        </div>
      </div>
    </div>
  );
}
