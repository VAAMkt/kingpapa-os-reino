export type LoyaltyHistoryCandidate = {
  delivery_id: string;
  local_id: number;
  customer_phone: string | null;
  customer_email: string | null;
  total: number;
  delivered_at: string | null;
  channel_id: number;
};

const DIRECT_CHANNEL_ID = 1;

function numberValue(value: unknown): number | null {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function toLoyaltyHistoryCandidate(
  row: Record<string, unknown>,
  fallbackLocalId: number,
): LoyaltyHistoryCandidate | null {
  if (numberValue(row.delivery_estado) !== 4) return null;
  const channelId = numberValue(row.canaldelivery_id);
  if (channelId !== DIRECT_CHANNEL_ID) return null;

  const deliveryId = String(row.delivery_id ?? "").trim();
  if (!deliveryId) return null;
  const phoneDigits = String(row.delivery_celular ?? "").replace(/\D/g, "");
  const phone = phoneDigits.length >= 10 ? phoneDigits.slice(-10) : null;
  const rawEmail = String(row.delivery_email ?? "")
    .trim()
    .toLowerCase();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;
  if (!phone && !email) return null;

  const total = numberValue(row.delivery_importe) ?? 0;
  if (total < 0) return null;
  const rawDate = row.delivery_fechaentrega ?? row.delivery_fecha;
  const date = rawDate ? new Date(String(rawDate)) : null;

  return {
    delivery_id: deliveryId,
    local_id: numberValue(row.local_id) ?? fallbackLocalId,
    customer_phone: phone,
    customer_email: email,
    total,
    delivered_at: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
    channel_id: channelId,
  };
}
