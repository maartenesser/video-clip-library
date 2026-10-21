export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // eMudhra CA compromise (Oct 2026): drop emSign roots until Vercel serves Node >= 24.22.1.
    const { distrustEmudhra } = await import("./lib/security/distrust-emudhra");
    distrustEmudhra();
  }
}
