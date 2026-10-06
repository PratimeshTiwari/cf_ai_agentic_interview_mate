import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Code,
  Keyboard,
  Loader2,
  Mic,
  PhoneOff,
  Send,
  Square,
  Volume2,
  VolumeX
} from "lucide-react";
import type { InterviewAgent } from "../../agents/interview";
import { messageText } from "../../lib/transcript";
import { INITIAL_INTERVIEW_STATE, type InterviewState } from "../../lib/types";
import { AgentLog } from "../components/AgentLog";
import { AIOrb } from "../components/AIOrb";
import { CodeWorkspace } from "../components/CodeWorkspace";
import { ReportModal } from "../components/ReportModal";
import { UserVideo } from "../components/UserVideo";
import { useLastDefined } from "../hooks/useLastDefined";
import { useSpeaker } from "../hooks/useSpeaker";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { getCurrentUser } from "../lib/session";

const CODING_CUES = [
  "write a function",
  "write code",
  "implement a",
  "implement the",
  "solve this problem",
  "code this",
  "write a solution",
  "coding challenge",
  "coding problem"
];
const TECHNICAL_ROLE =
  /engineer|developer|programmer|data scientist|sre|devops/i;

export function InterviewPage() {
  const user = getCurrentUser();
  const { sessionId } = useParams();
  if (!user) return <Navigate to="/login" replace />;
  if (!sessionId) return <Navigate to="/dashboard" replace />;
  return <InterviewRoom sessionId={sessionId} />;
}

function InterviewRoom({ sessionId }: { sessionId: string }) {
  const user = getCurrentUser()!;
  const navigate = useNavigate();

  const agent = useAgent<InterviewAgent, InterviewState>({
    agent: "InterviewAgent",
    name: sessionId
  });
  const syncedState = useLastDefined(agent.state);
  const state = syncedState ?? INITIAL_INTERVIEW_STATE;
  const { messages, sendMessage, status } = useAgentChat({ agent });
  const busy = status === "submitted" || status === "streaming";

  const speaker = useSpeaker();
  const [textInput, setTextInput] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showLog, setShowLog] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Only speak replies produced while this tab is in use (not on reload).
  const interactedRef = useRef(false);
  const spokenIdRef = useRef<string | null>(null);
  const autoOpenedRef = useRef<string | null>(null);

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages]
  );
  const assistantText = lastAssistant ? messageText(lastAssistant) : "";
  const isTechnical = TECHNICAL_ROLE.test(state.config?.role ?? "");

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || state.status !== "active") return;
      interactedRef.current = true;
      speaker.stop();
      void sendMessage({ text: trimmed });
    },
    [busy, sendMessage, speaker, state.status]
  );

  const speech = useSpeechRecognition({ onSilence: submit });

  // Speak each finished interviewer reply once.
  useEffect(() => {
    if (status !== "ready" || !lastAssistant) return;
    if (spokenIdRef.current === lastAssistant.id) return;
    spokenIdRef.current = lastAssistant.id;
    if (interactedRef.current) void speaker.speak(assistantText);
  }, [status, lastAssistant, assistantText, speaker]);

  // Open the coding workspace when the interviewer asks for code.
  useEffect(() => {
    if (!isTechnical || status !== "ready" || !lastAssistant) return;
    if (autoOpenedRef.current === lastAssistant.id) return;
    const lower = assistantText.toLowerCase();
    const asksForCode = CODING_CUES.some((cue) => lower.includes(cue));
    if (asksForCode) {
      autoOpenedRef.current = lastAssistant.id;
      setShowCode(true);
    }
  }, [isTechnical, status, lastAssistant, assistantText]);

  // Surface the analyzer's private coaching note for a few seconds.
  const latestTurn = state.turns.at(-1);
  useEffect(() => {
    if (!latestTurn?.feedback || !interactedRef.current) return;
    setFeedback(latestTurn.feedback);
    const t = setTimeout(() => setFeedback(null), 8000);
    return () => clearTimeout(t);
  }, [latestTurn?.turn, latestTurn?.feedback]);

  // Keep the server-side inactivity watchdog fed while the candidate is busy.
  const activeRef = useRef(false);
  activeRef.current =
    speech.isListening ||
    textInput.length > 0 ||
    speaker.isSpeaking ||
    showCode;
  useEffect(() => {
    if (state.status !== "active") return;
    const id = setInterval(() => {
      if (activeRef.current) agent.stub.touch().catch(() => {});
    }, 20_000);
    return () => clearInterval(id);
  }, [agent, state.status]);

  const handleMic = () => {
    if (speech.isListening) submit(speech.finish());
    else {
      speaker.stop();
      speech.start();
    }
  };

  const handleEnd = () => {
    speech.stop();
    speaker.stop();
    agent.stub.endSession("manual").catch(console.error);
  };

  if (!syncedState) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen overflow-hidden relative bg-[#050505] text-white">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-[#050505] to-black pointer-events-none" />

      <header className="absolute top-0 left-0 w-full p-4 sm:p-6 flex justify-between items-center z-20">
        <div
          className={`flex items-center gap-2 pl-10 transition-all ${showLog ? "sm:pl-0 sm:ml-80" : ""}`}
        >
          <span
            className={`w-3 h-3 rounded-full ${state.status === "active" ? "bg-red-500 animate-pulse" : "bg-slate-600"}`}
          />
          <span className="font-mono text-xs tracking-widest uppercase text-slate-400">
            {state.status === "setup" ? "Setup" : "Live"} ·{" "}
            {state.config?.role ?? user.role}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <IconButton
            label={speaker.muted ? "Unmute interviewer" : "Mute interviewer"}
            onClick={() => {
              speaker.stop();
              speaker.setMuted(!speaker.muted);
            }}
          >
            {speaker.muted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </IconButton>
          <IconButton
            label="Toggle coding workspace"
            active={showCode}
            onClick={() => setShowCode(!showCode)}
          >
            <Code className="w-5 h-5" />
          </IconButton>
          {state.status === "active" && (
            <button
              onClick={handleEnd}
              className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 flex items-center gap-2 text-sm"
            >
              <PhoneOff className="w-4 h-4" />
              <span className="hidden sm:inline">End interview</span>
            </button>
          )}
        </div>
      </header>

      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-4">
        <div className="mb-8">
          <AIOrb
            isSpeaking={speaker.isSpeaking}
            isThinking={busy || state.analyzing}
          />
        </div>

        <div className="min-h-32 flex flex-col items-center justify-center text-center max-w-3xl">
          <AnimatePresence mode="wait">
            {speech.isListening ? (
              <motion.p
                key="listening"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xl sm:text-2xl font-light text-cyan-100"
              >
                {`${speech.transcript} ${speech.interim}`.trim() ||
                  "Listening…"}
              </motion.p>
            ) : status === "submitted" ? (
              <motion.p
                key="thinking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-lg text-amber-400 flex items-center gap-2"
              >
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" />
                Ava is thinking…
              </motion.p>
            ) : assistantText ? (
              <motion.div
                key={lastAssistant?.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-2xl max-h-64 overflow-y-auto scrollbar-thin"
              >
                <p className="text-base sm:text-lg text-cyan-100 leading-relaxed whitespace-pre-wrap">
                  {assistantText}
                </p>
              </motion.div>
            ) : (
              <motion.p key="idle" className="text-slate-500">
                Ava will greet you once the interview starts.
              </motion.p>
            )}
          </AnimatePresence>
          {speech.error && (
            <p className="mt-3 text-xs text-red-400">
              Mic error: {speech.error}
            </p>
          )}
        </div>

        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 max-w-md text-xs text-violet-200 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2"
            >
              Coach note: {feedback}
            </motion.div>
          )}
        </AnimatePresence>

        {state.status === "active" && (
          <div className="absolute bottom-8 sm:bottom-12 flex items-center gap-4 sm:gap-6 w-full justify-center px-4">
            <button
              onClick={() => setShowKeyboard(!showKeyboard)}
              aria-label="Toggle keyboard input"
              className={`p-3 rounded-full transition-colors ${showKeyboard ? "bg-cyan-500 text-white" : "bg-white/10 text-slate-400 hover:bg-white/20"}`}
            >
              <Keyboard className="w-5 h-5" />
            </button>
            {showKeyboard || !speech.supported ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(textInput);
                  setTextInput("");
                }}
                className="flex gap-2 bg-black/50 p-2 rounded-2xl border border-white/10 backdrop-blur-md w-full max-w-md"
              >
                <input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your answer…"
                  aria-label="Your answer"
                  className="flex-1 min-w-0 bg-transparent text-white px-3 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || busy}
                  className="p-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white disabled:opacity-50"
                  aria-label="Send answer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button
                onClick={handleMic}
                disabled={busy}
                aria-label={
                  speech.isListening ? "Stop and send" : "Start speaking"
                }
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-2xl disabled:opacity-50 ${
                  speech.isListening
                    ? "bg-red-500 shadow-red-500/50"
                    : "bg-white text-black shadow-white/20"
                }`}
              >
                {speech.isListening ? (
                  <Square className="w-6 h-6 fill-current text-white" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="absolute top-20 right-4 sm:top-24 sm:right-6 z-30 hidden sm:block">
        <UserVideo />
      </div>

      <AgentLog
        turns={state.turns}
        analyzing={state.analyzing}
        phase={state.phase}
        isOpen={showLog}
        toggle={() => setShowLog(!showLog)}
      />

      <AnimatePresence>
        {showCode && (
          <CodeWorkspace
            disabled={busy || state.status !== "active"}
            onClose={() => setShowCode(false)}
            onSubmit={(code, language) => {
              submit(`Here is my ${language} solution:\n\n${code}`);
              setShowCode(false);
            }}
          />
        )}
      </AnimatePresence>

      {state.status === "setup" && (
        <SetupPanel
          defaultRole={user.role}
          onStart={async (details) => {
            await agent.stub.configure({
              userId: user.id,
              candidateName: user.name,
              ...details
            });
            interactedRef.current = true;
            void sendMessage({ text: "Hi, I'm ready to start the interview." });
          }}
          onCancel={() => navigate("/dashboard")}
        />
      )}

      {(state.status === "ending" || state.status === "complete") && (
        <ReportModal
          report={state.report}
          progress={state.reportProgress}
          endedReason={state.endedReason}
          onDone={() => navigate("/dashboard")}
        />
      )}
    </main>
  );
}

function IconButton({
  label,
  active,
  onClick,
  children
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-2 rounded-lg transition-colors border ${
        active
          ? "bg-cyan-500 text-white border-cyan-500"
          : "bg-white/5 text-slate-400 border-white/10 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function SetupPanel({
  defaultRole,
  onStart,
  onCancel
}: {
  defaultRole: string;
  onStart: (details: {
    role: string;
    resume: string;
    jobDescription: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [role, setRole] = useState(defaultRole);
  const [resume, setResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [starting, setStarting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div>
          <h2 className="text-xl font-bold text-white">
            Set up your interview
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Ava tailors questions to your resume and the job description, and
            remembers what she learned from past sessions.
          </p>
        </div>
        <Field label="Target role">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-cyan-500"
          />
        </Field>
        <Field label="Resume summary (optional)">
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            placeholder="Paste your resume or a short summary of your experience"
            className="w-full h-28 bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 resize-none"
          />
        </Field>
        <Field label="Job description (optional)">
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description you're preparing for"
            className="w-full h-28 bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 resize-none"
          />
        </Field>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg text-sm text-slate-400 border border-white/10 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            disabled={starting || !role.trim()}
            onClick={async () => {
              setStarting(true);
              try {
                await onStart({ role, resume, jobDescription });
              } finally {
                setStarting(false);
              }
            }}
            className="flex-[2] py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {starting && <Loader2 className="w-4 h-4 animate-spin" />}
            Start interview
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-slate-400 uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
