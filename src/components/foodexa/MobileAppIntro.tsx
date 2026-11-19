import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const STUDENT_INTRO_COMPLETED_KEY = "hungry:student-intro:completed:v1";
const INTRO_VIDEO_SRC = "/HUNGRY%20Z%20INTRO%20VIDEO.mp4";

type IntroPhase = "playing" | "completed" | "playback-error";

export function hasCompletedStudentIntro() {
  try {
    return window.localStorage.getItem(STUDENT_INTRO_COMPLETED_KEY) === "true";
  } catch {
    return false;
  }
}

function saveIntroCompleted() {
  try {
    window.localStorage.setItem(STUDENT_INTRO_COMPLETED_KEY, "true");
  } catch {
    // Keep the intro usable if device storage is unavailable.
  }
}

export function resetStudentIntro() {
  try {
    window.localStorage.removeItem(STUDENT_INTRO_COMPLETED_KEY);
  } catch {
    // The app still signs out if device storage is unavailable.
  }
}

export function MobileAppIntro({ onContinue }: { onContinue: () => void }) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigationStartedRef = useRef(false);
  const [phase, setPhase] = useState<IntroPhase>("playing");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set the mobile autoplay requirements as DOM properties as well as JSX attributes.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    // Explicitly start playback and observe the promise so rejected autoplay is visible
    // and recoverable instead of leaving the user on an unexplained black screen.
    try {
      const playback = video.play();
      if (playback) {
        void playback.then(() => {
          if (!navigationStartedRef.current) {
            setPhase("playing");
            setIsLoading(false);
          }
        }).catch(() => {
          if (!navigationStartedRef.current) {
            setPhase("playback-error");
            setIsLoading(false);
          }
        });
      }
    } catch {
      if (!navigationStartedRef.current) {
        setPhase("playback-error");
        setIsLoading(false);
      }
    }
  }, []);

  function startPlayback() {
    const video = videoRef.current;
    if (!video || navigationStartedRef.current) return;
    setIsLoading(true);
    setPhase("playing");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) video.currentTime = 0;
      const playback = video.play();
      if (playback) {
        void playback.then(() => {
          if (!navigationStartedRef.current) setIsLoading(false);
        }).catch(() => {
          if (!navigationStartedRef.current) {
            setIsLoading(false);
            setPhase("playback-error");
          }
        });
      }
    } catch {
      if (!navigationStartedRef.current) {
        setIsLoading(false);
        setPhase("playback-error");
      }
    }
  }

  function completeIntro() {
    if (navigationStartedRef.current) return;
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.currentTime = video.duration || 0;
    }
    saveIntroCompleted();
    setPhase("completed");
    setIsLoading(false);
  }

  function openAccountSelection() {
    if (navigationStartedRef.current) return;
    navigationStartedRef.current = true;
    saveIntroCompleted();
    videoRef.current?.pause();
    onContinue();
    void navigate({ to: "/auth" });
  }

  return (
    <main className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-black px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <video
          ref={videoRef}
          aria-label="HUNGRY Z introduction"
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          controls={phase === "playback-error"}
          className="h-full max-h-full max-w-full object-contain"
          style={{ width: "auto" }}
          onLoadedMetadata={(event) => {
            if (event.currentTarget.currentTime !== 0) event.currentTarget.currentTime = 0;
          }}
          onPlaying={() => {
            setPhase("playing");
            setIsLoading(false);
          }}
          onWaiting={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
          onEnded={completeIntro}
          onError={() => {
            setPhase("playback-error");
            setIsLoading(false);
          }}
        >
          <source src={INTRO_VIDEO_SRC} type="video/mp4" />
        </video>

        {isLoading && phase === "playing" && (
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
            <span className="rounded-full bg-black/70 px-4 py-2 text-xs text-white/90">Loading intro video…</span>
          </div>
        )}

        {phase === "playback-error" && (
          <div className="absolute inset-x-5 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 text-center">
            <p className="rounded-xl bg-black/75 px-4 py-3 text-sm text-white">The intro video could not start.</p>
            <button
              type="button"
              onClick={startPlayback}
              className="rounded-full border border-white/70 bg-black/70 px-5 py-2.5 text-sm font-semibold text-white"
            >
              PLAY VIDEO
            </button>
          </div>
        )}
      </div>

      {phase === "completed" && (
        <button
          type="button"
          onClick={openAccountSelection}
          className="mt-4 w-full max-w-sm rounded-full bg-[#e60012] px-8 py-4 text-base font-extrabold tracking-wide text-white shadow-[0_8px_32px_rgba(230,0,18,0.35)] transition hover:bg-[#ff1728] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          CREATE ACCOUNT
        </button>
      )}
    </main>
  );
}
