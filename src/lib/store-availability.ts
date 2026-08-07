export type Ventana = { abre: string; cierra: string };
export type HorariosMap = Partial<
  Record<"lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom", Ventana[]>
>;

const DIAS: Array<keyof HorariosMap> = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];
const WEEKDAYS: Record<string, keyof HorariosMap> = {
  sun: "dom",
  mon: "lun",
  tue: "mar",
  wed: "mie",
  thu: "jue",
  fri: "vie",
  sat: "sab",
};

function hhmmAMinutos(hhmm: string): number {
  const [hour = "", minute = ""] = hhmm.split(":");
  const value = Number(hour) * 60 + Number(minute);
  return Number.isFinite(value) ? value : -1;
}

function localParts(at: Date, tz: string): { dia: keyof HorariosMap; hhmm: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || "America/Bogota",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const weekday = (parts.find((p) => p.type === "weekday")?.value ?? "Sun").toLowerCase();
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { dia: WEEKDAYS[weekday] ?? "dom", hhmm: `${hour}:${minute}` };
}

function startsToday(hhmm: string, ventana: Ventana): boolean {
  const now = hhmmAMinutos(hhmm);
  const opens = hhmmAMinutos(ventana.abre);
  const closes = hhmmAMinutos(ventana.cierra);
  if (now < 0 || opens < 0 || closes < 0) return false;
  if (opens === closes) return true;
  return closes > opens ? now >= opens && now <= closes : now >= opens;
}

function startedYesterday(hhmm: string, ventana: Ventana): boolean {
  const now = hhmmAMinutos(hhmm);
  const opens = hhmmAMinutos(ventana.abre);
  const closes = hhmmAMinutos(ventana.cierra);
  return now >= 0 && opens >= 0 && closes >= 0 && closes < opens && now <= closes;
}

export function isSedeOpenAt(
  horarios: HorariosMap | null | undefined,
  tz: string | null | undefined,
  at: Date,
): boolean {
  if (Number.isNaN(at.getTime())) return false;
  const { dia, hhmm } = localParts(at, tz ?? "America/Bogota");
  const today = horarios?.[dia] ?? [];
  const yesterday = DIAS[(DIAS.indexOf(dia) + DIAS.length - 1) % DIAS.length];
  return (
    today.some((ventana) => startsToday(hhmm, ventana)) ||
    (horarios?.[yesterday] ?? []).some((ventana) => startedYesterday(hhmm, ventana))
  );
}

export function pickupScheduleError(
  iso: string | null | undefined,
  horarios: HorariosMap | null | undefined,
  tz: string | null | undefined,
  now = new Date(),
): string | null {
  if (!iso) return "Selecciona el día y la hora para recoger tu pedido";
  const scheduled = new Date(iso);
  if (Number.isNaN(scheduled.getTime())) return "Fecha de recogida inválida";
  const delta = scheduled.getTime() - now.getTime();
  if (delta < 20 * 60_000) return "Elige una hora con al menos 20 minutos de anticipación";
  if (delta > 7 * 24 * 60 * 60_000) return "Solo puedes programar la recogida hasta 7 días adelante";
  if (!isSedeOpenAt(horarios, tz, scheduled)) {
    return "La sede estará cerrada en la fecha y hora seleccionadas";
  }
  return null;
}

export function formatInTimeZone(
  at: Date,
  tz: string | null | undefined,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}
