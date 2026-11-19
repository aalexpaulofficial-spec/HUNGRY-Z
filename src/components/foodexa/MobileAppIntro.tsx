import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const STUDENT_INTRO_COMPLETED_KEY = "hungry:student-intro:completed:v1";

export function hasCompletedStudentIntro() {
  try {
    return window.localStorage.getItem(STUDENT_INTRO_COMPLETED_KEY) === "true";
  } catch {
    return false;
  }
}

export function MobileAppIntro({ onContinue }: { onContinue: () => void }) {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  function finishIntro(video?: HTMLVideoElement) {
    video?.pause();
    try {
      window.localStorage.setItem(STUDENT_INTRO_COMPLETED_KEY, "true");
    } catch {
      // Keep this launch usable if storage is unavailable; the intro can be replayed next time.
    }
    setReady(true);
  }

  return (
    <main className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-black px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        <video
          aria-label="HUNGRY Z introduction"
          autoPlay
          muted
          playsInline
          preload="auto"
          className="max-h-full max-w-full object-contain"
          style={{ height: "100%", width: "auto" }}
          onEnded={(event) => finishIntro(event.currentTarget)}
          onError={(event) => finishIntro(event.currentTarget)}
        >
          <source src="/HUNGRY%20Z%20INTRO%20VIDEO.mp4" type="video/mp4" />
        </video>
      </div>

      {!ready ? (
        <button
          type="button"
          onClick={(event) => finishIntro(event.currentTarget.parentElement?.querySelector("video") ?? undefined)}
          className="mt-4 rounded-full border border-white/50 px-6 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          SKIP INTRO
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            onContinue();
            void navigate({ to: "/auth" });
          }}
          className="mt-4 w-full max-w-sm rounded-full bg-[#e60012] px-8 py-4 text-base font-extrabold tracking-wide text-white shadow-[0_8px_32px_rgba(230,0,18,0.35)] transition hover:bg-[#ff1728] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          CREATE ACCOUNT
        </button>
      )}
    </main>
  );
}
