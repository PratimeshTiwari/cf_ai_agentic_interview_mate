import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Plays interviewer replies: Workers AI TTS via /api/speak first, then the
 * browser's speechSynthesis as a fallback.
 */
export function useSpeaker() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanup = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };

  const stop = useCallback(() => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    cleanup();
    setIsSpeaking(false);
  }, []);

  const speakWithBrowser = (text: string) =>
    new Promise<void>((resolve) => {
      if (!window.speechSynthesis) return resolve();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim() || muted) return;
      stop();
      setIsSpeaking(true);
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error(`TTS ${res.status}`);
        const url = URL.createObjectURL(await res.blob());
        urlRef.current = url;
        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        audio.src = url;
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("playback failed"));
          audio.play().catch(reject);
        });
      } catch (error) {
        console.warn("Falling back to browser speech", error);
        await speakWithBrowser(text);
      } finally {
        cleanup();
        setIsSpeaking(false);
      }
    },
    [muted, stop]
  );

  useEffect(() => stop, [stop]);

  return { speak, stop, isSpeaking, muted, setMuted };
}
