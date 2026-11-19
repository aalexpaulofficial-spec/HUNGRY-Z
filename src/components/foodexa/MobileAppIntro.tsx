import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

// v3 discards prior CTA-based completion flags. Completion now means successful
// signup/login only, so pending installs must see the intro again after updating.
export const STUDENT_INTRO_COMPLETED_KEY = "hungry:student-intro:completed:v3";
const INTRO_ANIMATION_SRC = "/HUNGRYZ%20INTRO%20ANIMATION.webp";
const INTRO_FRAME_COUNT = 155;
const INTRO_FRAME_DURATION_MS = 40;
const INTRO_ANIMATION_DURATION_MS = INTRO_FRAME_COUNT * INTRO_FRAME_DURATION_MS;

type IntroPhase = "playing" | "completed" | "animation-error";

export function hasCompletedStudentIntro() {
  try {
    return window.localStorage.getItem(STUDENT_INTRO_COMPLETED_KEY) === "true";
  } catch {
    return false;
  }
}

export function markStudentIntroCompleted() {
  try {
    window.localStorage.setItem(STUDENT_INTRO_COMPLETED_KEY, "true");
  } catch {
    // Keep the intro usable if device storage is unavailable.
  }
}

export function resetStudentIntro() {
  try {
    window.localStorage.removeItem(STUDENT_INTRO_COMPLETED_KEY);
    window.localStorage.removeItem("hungry:student-intro:completed:v2");
    window.localStorage.removeItem("hungry:student-intro:completed:v1");
  } catch {
    // The app still signs out if device storage is unavailable.
  }
  window.dispatchEvent(new Event("hungry:student-intro:reset"));
}

export function MobileAppIntro({ onContinue }: { onContinue: () => void }) {
  const navigate = useNavigate();
  const navigationStartedRef = useRef(false);
  const [phase, setPhase] = useState<IntroPhase>("playing");
  const [animationLoaded, setAnimationLoaded] = useState(false);
  const [animationAttempt, setAnimationAttempt] = useState(0);

  useEffect(() => {
    if (!animationLoaded || phase !== "playing") return;
    const timer = window.setTimeout(() => {
      if (navigationStartedRef.current) return;
      setPhase("completed");
    }, INTRO_ANIMATION_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [animationLoaded, phase]);

  function retryAnimation() {
    setAnimationLoaded(false);
    setPhase("playing");
    setAnimationAttempt((attempt) => attempt + 1);
  }

  function openAccountSelection() {
    if (navigationStartedRef.current) return;
    navigationStartedRef.current = true;
    onContinue();
    void navigate({ to: "/auth" });
  }

  return (
    <main className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-black px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <img
          key={animationAttempt}
          alt="HUNGRY Z introduction animation"
          src={`${INTRO_ANIMATION_SRC}?attempt=${animationAttempt}`}
          className="absolute inset-0 h-full w-full object-cover"
          onLoad={() => {
            setAnimationLoaded(true);
            setPhase("playing");
          }}
          onError={() => {
            setAnimationLoaded(false);
            setPhase("animation-error");
          }}
        />

        {!animationLoaded && phase === "playing" && (
          <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
            <span className="rounded-full bg-black/70 px-4 py-2 text-xs text-white/90">Loading intro animation…</span>
          </div>
        )}

        {phase === "animation-error" && (
          <div className="absolute inset-x-5 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 text-center">
            <p className="rounded-xl bg-black/75 px-4 py-3 text-sm text-white">The intro animation could not load.</p>
            <button
              type="button"
              onClick={retryAnimation}
              className="rounded-full border border-white/70 bg-black/70 px-5 py-2.5 text-sm font-semibold text-white"
            >
              RETRY ANIMATION
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
