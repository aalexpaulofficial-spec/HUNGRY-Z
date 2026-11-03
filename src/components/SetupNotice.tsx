/** Shown on account pages while the database connection hasn't been configured yet. */
export function SetupNotice({ title = "HUNGRY is almost ready" }: { title?: string }) {
  return (
    <div className="grain relative grid min-h-screen place-items-center overflow-hidden bg-background px-4">
      <div className="ember anim-pulse-glow pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2" />
      <div className="glass-red anim-rise relative w-full max-w-md rounded-[2rem] p-8 text-center">
        <a href="/" className="display text-[15px] tracking-[0.3em]">HUNGRY</a>
        <h1 className="display mt-6 text-2xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Accounts, ordering and payments switch on as soon as the HUNGRY database is connected. The site owner can follow the setup guide (docs/SETUP.md) to finish this.
        </p>
        <a href="/" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">Back to HUNGRY</a>
      </div>
    </div>
  );
}
