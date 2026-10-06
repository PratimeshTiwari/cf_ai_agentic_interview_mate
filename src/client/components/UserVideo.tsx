import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { VideoOff } from "lucide-react";

/** Local camera preview only — nothing is recorded or uploaded. */
export function UserVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setFailed(true));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="w-40 h-28 sm:w-48 sm:h-36 bg-black rounded-xl overflow-hidden border border-white/20 shadow-2xl relative cursor-move"
    >
      {failed ? (
        <div className="w-full h-full flex items-center justify-center text-slate-500">
          <VideoOff className="w-6 h-6" />
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover -scale-x-100"
        />
      )}
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-[10px] text-white backdrop-blur-sm">
        You
      </div>
    </motion.div>
  );
}
