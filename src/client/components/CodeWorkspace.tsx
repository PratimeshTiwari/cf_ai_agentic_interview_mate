import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Code, GripVertical, Send, X } from "lucide-react";

const LANGUAGES = {
  javascript: { label: "JavaScript", comment: "//" },
  typescript: { label: "TypeScript", comment: "//" },
  python: { label: "Python", comment: "#" },
  java: { label: "Java", comment: "//" },
  cpp: { label: "C++", comment: "//" },
  go: { label: "Go", comment: "//" }
} as const;
type Language = keyof typeof LANGUAGES;

const placeholder = (lang: Language) =>
  `${LANGUAGES[lang].comment} Write your ${LANGUAGES[lang].label} solution here...\n`;

/** Resizable slide-over editor. Submitted code is sent as a normal answer. */
export function CodeWorkspace({
  onClose,
  onSubmit,
  disabled
}: {
  onClose: () => void;
  onSubmit: (code: string, languageLabel: string) => void;
  disabled: boolean;
}) {
  const [language, setLanguage] = useState<Language>("javascript");
  const [code, setCode] = useState(placeholder("javascript"));
  const [width, setWidth] = useState(420);
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    if (!resizing) return;
    const move = (e: MouseEvent) =>
      setWidth(Math.max(320, Math.min(900, window.innerWidth - e.clientX)));
    const up = () => setResizing(false);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  const isEmpty = !code.trim() || code === placeholder(language);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      style={{ width: `min(${width}px, 100vw)` }}
      className="fixed right-0 top-0 h-full bg-[#1e1e1e] border-l border-white/10 z-40 shadow-2xl flex"
    >
      <button
        type="button"
        aria-label="Drag to resize workspace"
        onMouseDown={() => setResizing(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setWidth((w) => Math.min(900, w + 40));
          if (e.key === "ArrowRight") setWidth((w) => Math.max(320, w - 40));
        }}
        className="hidden sm:flex w-1.5 bg-white/5 hover:bg-cyan-500/50 cursor-ew-resize items-center justify-center group"
      >
        <GripVertical className="w-4 h-4 text-slate-600 group-hover:text-cyan-400" />
      </button>
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        <div className="flex justify-between items-center mb-4 text-slate-400">
          <span className="font-mono text-sm flex items-center gap-2">
            <Code className="w-4 h-4" /> Coding Workspace
          </span>
          <button
            onClick={onClose}
            className="hover:text-white p-1 hover:bg-white/10 rounded"
            aria-label="Close workspace"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label
          htmlFor="workspace-language"
          className="text-xs text-slate-400 uppercase font-medium mb-2 block"
        >
          Language
        </label>
        <div className="relative mb-3">
          <select
            id="workspace-language"
            value={language}
            onChange={(e) => {
              const next = e.target.value as Language;
              if (isEmpty) setCode(placeholder(next));
              setLanguage(next);
            }}
            className="w-full bg-[#0d1117] text-slate-300 border border-white/10 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-cyan-500 pr-8"
          >
            {Object.entries(LANGUAGES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const el = e.currentTarget;
              const { selectionStart: s, selectionEnd: end } = el;
              setCode(code.slice(0, s) + "  " + code.slice(end));
              requestAnimationFrame(() => {
                el.selectionStart = el.selectionEnd = s + 2;
              });
            }
          }}
          spellCheck={false}
          className="flex-1 mb-3 w-full bg-[#0d1117] text-slate-300 p-4 font-mono text-sm focus:outline-none resize-none border border-white/10 rounded-lg focus:border-cyan-500"
        />

        <button
          onClick={() => {
            onSubmit(code, LANGUAGES[language].label);
            setCode(placeholder(language));
          }}
          disabled={isEmpty || disabled}
          className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Send className="w-4 h-4" /> Submit for review
        </button>
      </div>
    </motion.div>
  );
}
