import { useEffect, useRef, useState } from "react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Send, Trash2, X } from "lucide-react";
import { messageText } from "../../lib/transcript";

type AgentConnection = Parameters<typeof useAgentChat>[0]["agent"];

/** Floating prep-coach chat backed by the candidate's UserAgent. */
export function CoachChat({ agent }: { agent: AgentConnection }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, clearHistory } = useAgentChat({
    agent
  });
  const busy = status === "submitted" || status === "streaming";
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] sm:w-96 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px] max-h-[75vh]"
          >
            <div className="p-4 bg-gradient-to-r from-blue-600 to-violet-600 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <h3 className="text-white font-bold text-sm">Prep coach</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => clearHistory()}
                  className="text-white/70 hover:text-white"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-white/80 hover:text-white"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50 scrollbar-thin">
              {messages.length === 0 && (
                <p className="text-sm text-slate-400">
                  Ask me what to practise next, how to fix a weak area, or to
                  explain a concept. I know your past sessions.
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-xl text-sm whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-white/10 text-slate-200 rounded-tl-none"
                    }`}
                  >
                    {messageText(m)}
                  </div>
                </div>
              ))}
              {status === "submitted" && (
                <div className="flex gap-1 p-3">
                  {[0, 0.1, 0.2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}s` }}
                    />
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!input.trim() || busy) return;
                void sendMessage({ text: input.trim() });
                setInput("");
              }}
              className="p-3 border-t border-white/10 bg-slate-900 flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for interview tips…"
                aria-label="Message the prep coach"
                className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="p-3 bg-blue-600 rounded-xl text-white disabled:opacity-50 hover:bg-blue-500"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close prep coach" : "Open prep coach"}
        className="w-14 h-14 bg-gradient-to-r from-blue-600 to-violet-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform"
      >
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageSquare className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}
