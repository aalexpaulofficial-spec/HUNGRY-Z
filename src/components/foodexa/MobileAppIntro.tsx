import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

// v3 discards prior CTA-based completion flags. Completion means successful signup/login.
export const STUDENT_INTRO_COMPLETED_KEY = "hungry:student-intro:completed:v3";
const INTRO_FRAME_DURATION_MS = 40;
const INTRO_SEGMENTS = [
  { src: "/HUNGRYZ%20INTRO%20SEGMENT%201.webp", frames: 300 },
  { src: "/HUNGRYZ%20INTRO%20SEGMENT%202.webp", frames: 270 },
  { src: "/HUNGRYZ%20INTRO%20SEGMENT%203.webp", frames: 270 },
  { src: "/HUNGRYZ%20INTRO%20SEGMENT%204.webp", frames: 60 },
] as const;

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
    // Keep the auth flow usable if device storage is unavailable.
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
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [segmentLoaded, setSegmentLoaded] = useState(false);
  const [animationError, setAnimationError] = useState(false);
  const [animationAttempt, setAnimationAttempt] = useState(0);
  const segment = INTRO_SEGMENTS[segmentIndex]!;

  useEffect(() => {
    if (!segmentLoaded || animationError || navigationStartedRef.current) return;
    const timer = window.setTimeout(() => {
      setSegmentLoaded(false);
      setSegmentIndex((index) => (index + 1) % INTRO_SEGMENTS.length);
    }, segment.frames * INTRO_FRAME_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [animationError, segment.frames, segmentIndex, segmentLoaded]);

  useEffect(() => {
    const nextSegment = INTRO_SEGMENTS[segmentIndex + 1];
    if (!nextSegment) return;
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = nextSegment.src;
    document.head.appendChild(preload);
    return () => preload.remove();
  }, [segmentIndex]);

  function openAuth(mode: "signup" | "login") {
    if (navigationStartedRef.current) return;
    navigationStartedRef.current = true;
    onContinue();
    void navigate({ to: "/auth", search: { mode } });
  }

  function openLegalPage() {
    if (navigationStartedRef.current) return;
    navigationStartedRef.current = true;
    onContinue();
  }

  function retryAnimation() {
    setAnimationError(false);
    setSegmentLoaded(false);
    setAnimationAttempt((attempt) => attempt + 1);
  }

  return (
    <main className="fixed inset-0 z-[100] min-h-[100dvh] overflow-hidden bg-black text-white">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <span className="rounded-full border border-white/15 bg-black/55 px-5 py-2 text-sm font-extrabold tracking-[0.32em] text-white shadow-lg backdrop-blur-sm">
          HUNGRY Z
        </span>
      </header>
      <img
        key={`${segmentIndex}-${animationAttempt}`}
        alt="HUNGRY Z introduction"
        src={animationAttempt === 0 ? segment.src : `${segment.src}?retry=${animationAttempt}`}
        className="absolute inset-0 h-full w-full object-cover"
        onLoad={() => {
          setSegmentLoaded(true);
          setAnimationError(false);
        }}
        onError={() => {
          setSegmentLoaded(false);
          setAnimationError(true);
        }}
      />

      {!segmentLoaded && !animationError && (
        <div aria-live="polite" className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center">
          <span className="rounded-full bg-black/70 px-4 py-2 text-xs text-white/90">Loading intro animation…</span>
        </div>
      )}

      {animationError && (
        <div className="absolute inset-x-5 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-3 text-center">
          <p className="rounded-xl bg-black/80 px-4 py-3 text-sm">The intro animation could not load.</p>
          <button type="button" onClick={retryAnimation} className="rounded-full border border-white/70 bg-black/80 px-5 py-2.5 text-sm font-semibold">
            RETRY ANIMATION
          </button>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/95 to-black/0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-24">
        <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => openAuth("signup")}
            className="min-h-14 rounded-full bg-[#e60012] px-4 py-4 text-sm font-extrabold tracking-wide text-white shadow-[0_8px_32px_rgba(230,0,18,0.35)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            CREATE ACCOUNT
          </button>
          <button
            type="button"
            onClick={() => openAuth("login")}
            className="min-h-14 rounded-full border border-white/65 bg-black/75 px-4 py-4 text-sm font-bold tracking-wide text-white backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            LOGIN
          </button>
        </div>
        <nav aria-label="Legal" className="mt-4 flex justify-center gap-3 text-xs font-medium text-white/85">
          <Link to="/privacy" onClick={openLegalPage} className="underline underline-offset-4">Privacy Policy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms" onClick={openLegalPage} className="underline underline-offset-4">Terms &amp; Conditions</Link>
        </nav>
      </div>
    </main>
  );
}
