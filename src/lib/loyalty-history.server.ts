import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { toLoyaltyHistoryCandidate } from "@/lib/loyalty-history";
import { rpListDeliveriesByLocal } from "@/lib/restaurantpe.server";

const PAGE_SIZE = 100;
const SEDES_PER_RUN = 3;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Sede = { rp_local_id: number | null };
type SyncState = {
  local_id: number;
  next_page: number;
  backfill_complete: boolean;
  updated_at: string;
};

export type LoyaltyHistorySyncResult = {
  scanned_sedes: number;
  scanned_rows: number;
  imported_rows: number;
  errors: number;
};

async function syncLocal(localId: number, state?: SyncState) {
  const page = state?.backfill_complete ? 1 : (state?.next_page ?? 1);
  try {
    const rows = await rpListDeliveriesByLocal(localId, page, PAGE_SIZE);
    const candidates = rows
      .map((row) => ({ row, candidate: toLoyaltyHistoryCandidate(row, localId) }))
      .filter((item) => item.candidate !== null);
    const deliveryIds = candidates.map(({ candidate }) => candidate!.delivery_id);
    const integrationIds = candidates
      .map(({ row }) => String(row.delivery_codigointegracion ?? "").trim())
      .filter((id) => UUID_RE.test(id));

    const [{ data: byDelivery }, { data: byIntegration }] = await Promise.all([
      deliveryIds.length
        ? supabaseAdmin.from("orders").select("rp_pedido_id").in("rp_pedido_id", deliveryIds)
        : Promise.resolve({ data: [] }),
      integrationIds.length
        ? supabaseAdmin.from("orders").select("id").in("id", integrationIds)
        : Promise.resolve({ data: [] }),
    ]);
    const localDeliveryIds = new Set((byDelivery ?? []).map((order) => order.rp_pedido_id));
    const localIntegrationIds = new Set((byIntegration ?? []).map((order) => order.id));
    const historyRows = candidates
      .filter(({ row, candidate }) => {
        const integrationId = String(row.delivery_codigointegracion ?? "").trim();
        return (
          !localDeliveryIds.has(candidate!.delivery_id) &&
          (!integrationId || !localIntegrationIds.has(integrationId))
        );
      })
      .map(({ candidate }) => candidate!);

    if (historyRows.length) {
      const { error } = await supabaseAdmin
        .from("loyalty_rp_orders")
        .upsert(historyRows, { onConflict: "delivery_id" });
      if (error) throw error;
    }

    const finished = state?.backfill_complete || rows.length < PAGE_SIZE;
    await supabaseAdmin.from("loyalty_rp_sync_state").upsert({
      local_id: localId,
      next_page: finished ? 1 : page + 1,
      backfill_complete: finished,
      last_error: null,
      updated_at: new Date().toISOString(),
    });
    return { scanned: rows.length, imported: historyRows.length, error: false };
  } catch (error) {
    await supabaseAdmin.from("loyalty_rp_sync_state").upsert({
      local_id: localId,
      next_page: page,
      backfill_complete: state?.backfill_complete ?? false,
      last_error: error instanceof Error ? error.message.slice(0, 500) : "sync_error",
      updated_at: new Date().toISOString(),
    });
    return { scanned: 0, imported: 0, error: true };
  }
}

export async function syncRestaurantPeLoyaltyHistoryCore(): Promise<LoyaltyHistorySyncResult> {
  const [{ data: sedes }, { data: states }] = await Promise.all([
    supabaseAdmin
      .from("sedes")
      .select("rp_local_id")
      .eq("publicado", true)
      .not("rp_local_id", "is", null),
    supabaseAdmin
      .from("loyalty_rp_sync_state")
      .select("local_id, next_page, backfill_complete, updated_at"),
  ]);
  const stateMap = new Map((states ?? []).map((state) => [state.local_id, state as SyncState]));
  const selected = ((sedes ?? []) as Sede[])
    .map((sede) => Number(sede.rp_local_id))
    .filter((localId) => Number.isFinite(localId) && localId > 0)
    .sort((a, b) => {
      const aTime = stateMap.get(a)?.updated_at;
      const bTime = stateMap.get(b)?.updated_at;
      return (aTime ? Date.parse(aTime) : 0) - (bTime ? Date.parse(bTime) : 0);
    })
    .slice(0, SEDES_PER_RUN);
  const results = await Promise.all(
    selected.map((localId) => syncLocal(localId, stateMap.get(localId))),
  );
  const result = results.reduce(
    (acc, row) => ({
      scanned_sedes: acc.scanned_sedes + 1,
      scanned_rows: acc.scanned_rows + row.scanned,
      imported_rows: acc.imported_rows + row.imported,
      errors: acc.errors + Number(row.error),
    }),
    { scanned_sedes: 0, scanned_rows: 0, imported_rows: 0, errors: 0 },
  );
  await supabaseAdmin.from("rp_sync_log").insert({
    tipo: "loyalty_history",
    ok: result.errors === 0,
    mensaje: `Histórico loyalty: ${result.imported_rows}/${result.scanned_rows} pedidos directos importados.`,
    payload: result,
  });
  return result;
}
