export function GlobalLoadingScreen({ overlay = false, visible = true, tone = "canteen" }: { overlay?: boolean; visible?: boolean; tone?: "canteen" | "student" }) {
  if (!visible) return null;

  return (
    <div className={`hz-global-loading${overlay ? " is-overlay" : ""}${tone === "student" ? " is-student" : ""}`} role="status" aria-label="Loading HUNGRY Z" aria-busy="true">
      <div className="hz-global-loading-mark" aria-hidden="true">
        <svg className="hz-global-loading-ring" viewBox="0 0 204 204" fill="none">
          <circle className="hz-global-loading-track" cx="102" cy="102" r="99" />
          <circle className="hz-global-loading-progress" cx="102" cy="102" r="99" />
        </svg>
        <img className="hz-global-loading-logo" src={tone === "student" ? "/HUNGRY%20Z%20Q%20LOGO.png" : "/HUNGRY%20Z%20CANTEEN%20DAHSBOARD%20LOGO.png"} alt="" />
      </div>
    </div>
  );
}
