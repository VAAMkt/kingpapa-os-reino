const SECRET_ENV = "INTERNAL_CRON_SECRET";

export function authorizeCronRequest(request: Request): Response | null {
  const expected = process.env.INTERNAL_CRON_SECRET?.trim();
  if (!expected) {
    console.error(`[Cron] Falta ${SECRET_ENV}`);
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }

  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const provided = request.headers.get("x-cron-secret") ?? bearer;

  return provided === expected ? null : Response.json({ error: "unauthorized" }, { status: 401 });
}
