export function GlobalLoadingScreen({ overlay = false, visible = true }: { overlay?: boolean; visible?: boolean }) {
  if (!visible) return null;

  return (
    <div className={`hz-global-loading${overlay ? " is-overlay" : ""}`} role="status" aria-label="Loading HUNGRY Z" aria-busy="true">
      <div className="hz-global-loading-mark" aria-hidden="true">
        <svg className="hz-global-loading-ring" viewBox="0 0 204 204" fill="none">
          <circle className="hz-global-loading-track" cx="102" cy="102" r="99" />
          <circle className="hz-global-loading-progress" cx="102" cy="102" r="99" />
        </svg>
        <svg className="hz-global-loading-logo" viewBox="0 0 48 56" fill="none">
          <path d="M0 0 14 8v14h15v7H14v27L0 48V0Z" fill="currentColor" />
          <path d="m29 0 19 10v17L29 17V0Z" fill="currentColor" />
          <path d="m29 33 19 10v13L29 46V33Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}
