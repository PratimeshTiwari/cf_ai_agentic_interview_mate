import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
type RecognitionResultList = ArrayLike<{
  isFinal: boolean;
  0: { transcript: string };
}>;
type RecognitionEvent = { resultIndex: number; results: RecognitionResultList };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Browser speech-to-text. Calls onSilence(transcript) after `silenceMs`
 * without new speech so answers submit hands-free.
 */
export function useSpeechRecognition({
  onSilence,
  silenceMs = 2000
}: {
  onSilence?: (transcript: string) => void;
  silenceMs?: number;
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const supported = typeof window !== "undefined" && !!getRecognitionCtor();

  const recognitionRef = useRef<Recognition | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const onSilenceRef = useRef(onSilence);
  onSilenceRef.current = onSilence;

  const clearTimer = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
  };

  const stop = useCallback(() => {
    clearTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }
    setError(null);
    finalRef.current = "";
    interimRef.current = "";
    setTranscript("");
    setInterim("");

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalChunk += result[0].transcript;
        else interimChunk += result[0].transcript;
      }
      if (finalChunk) {
        finalRef.current = `${finalRef.current} ${finalChunk}`.trim();
        setTranscript(finalRef.current);
      }
      interimRef.current = interimChunk;
      setInterim(interimChunk);

      clearTimer();
      silenceTimer.current = setTimeout(() => {
        const text = `${finalRef.current} ${interimRef.current}`.trim();
        stop();
        if (text) onSilenceRef.current?.(text);
      }, silenceMs);
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(event.error);
      }
      setIsListening(false);
    };
    recognition.onend = () => {
      clearTimer();
      setIsListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [silenceMs, stop]);

  /** Stops listening and returns everything heard so far. */
  const finish = useCallback(() => {
    const text = `${finalRef.current} ${interimRef.current}`.trim();
    stop();
    return text;
  }, [stop]);

  useEffect(() => stop, [stop]);

  return {
    supported,
    isListening,
    transcript,
    interim,
    error,
    start,
    stop,
    finish
  };
}
