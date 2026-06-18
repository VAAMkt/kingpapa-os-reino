// SERVER-ONLY: arma el payload del checkout y lo manda a Restaurant.pe.
//
// Mapeo de métodos de pago (confirmado en producción contra el POS):
//   delivery_tipopago: 1 = Efectivo (contra entrega)
//                       2 = Datafono / tarjeta presencial (tarjeta_id=1)
//                       5 = Pago online / web (sin pasarela integrada aún)
// TODO(pasarela): cuando se integre la pasarela online (PSE, Mercado Pago, etc.)
//   añadir al payload.delivery: delivery_montopagado (= total) y transaccion_id
//   con el id devuelto por la pasarela, para que el arqueo del POS cuadre.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { rpGetCatalogo, rpRegistrarDelivery } from "@/lib/restaurantpe.server";
import type { RpMenuData, RpProducto } from "@/types/restaurantpe";

export type CheckoutInputItem = {
  productoId: string; // productos_master.id (uuid)
  cantidad: number;
  modificadores?: { grupoId: number; opcionId: number }[];
};

export type CheckoutInput = {
  sedeId: string;
  tipo: "delivery" | "pickup";
  pago: "efectivo" | "datafono" | "online";
  cliente: {
    nombre: string;
    telefono: string;
    direccion?: string | null;
    detalles?: string | null;
  };
  notas?: string | null;
  items: CheckoutInputItem[];
  userId?: string | null;
};

type ModOption = { id: number; nombre: string; precio: number };
type ModGroup = { id: number; nombre: string; opciones: ModOption[] };

type ProductoMasterRow = {
  id: string;
  rp_id: number;
  almacen_id: number | null;
  nombre: string;
  precio: number | string;
  modificadores: unknown;
};

type SedeRow = {
  id: string;
  nombre: string;
  rp_local_id: number | null;
};

type DetallePedido = {
  productoId: string;
  nombre: string;
  rp_id: number;
  pedido_productoid: number;
  almacen_id: number | null;
  cantidad: number;
  precio_unitario: number; // ya incluye modificadores
  subtotal: number;
  modificadores: { grupoId: number; opcionId: number; nombre: string; precio: number }[];
};

// FASE 3 — horarios + banderas operativas
export type Ventana = { abre: string; cierra: string };
export type HorariosMap = Partial<Record<"lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom", Ventana[]>>;

const DIAS: Array<keyof HorariosMap> = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

function nowInTz(tz: string): { dia: keyof HorariosMap; hhmm: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || "America/Bogota",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wd = (parts.find((p) => p.type === "weekday")?.value ?? "Sun").toLowerCase();
  const map: Record<string, keyof HorariosMap> = {
    sun: "dom", mon: "lun", tue: "mar", wed: "mie", thu: "jue", fri: "vie", sat: "sab",
  };
  const dia = map[wd] ?? DIAS[new Date().getDay()];
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { dia, hhmm: `${hour}:${minute}` };
}

function dentroDeVentana(hhmm: string, v: Ventana): boolean {
  return hhmm >= v.abre && hhmm <= v.cierra;
}

function describeVentanas(vs: Ventana[]): string {
  if (!vs || vs.length === 0) return "cerrada hoy";
  return vs.map((v) => `${v.abre} a ${v.cierra}`).join(" y ");
}

function assertSedeOperativa(
  sede: {
    nombre: string;
    horarios: HorariosMap | null;
    tz: string | null;
    kill_switch: boolean | null;
    rp_local_estado: number | null;
    rp_acepta_delivery: number | null;
  },
  tipo: "delivery" | "pickup",
  opts: { bypass?: boolean } = {},
): void {
  // Bypass para staff (super_admin / editor): permite pedidos de prueba 24/7,
  // incluso fuera de horario o con kill_switch activo. Se loguea aparte.
  if (opts.bypass) return;
  if (sede.kill_switch) {
    throw new Error(`"${sede.nombre}" está temporalmente cerrada hoy. Intenta más tarde o contáctanos por WhatsApp.`);
  }
  // Banderas del POS (si están cacheadas). null = aún no sincronizado, no bloqueamos.
  if (sede.rp_local_estado != null && sede.rp_local_estado !== 1) {
    throw new Error(`"${sede.nombre}" no está activa en el sistema central. Contáctanos por WhatsApp.`);
  }
  if (tipo === "delivery" && sede.rp_acepta_delivery != null && sede.rp_acepta_delivery !== 1) {
    throw new Error(`"${sede.nombre}" no acepta domicilios por ahora. Prueba la opción de recoger en sede.`);
  }
  // Horarios locales.
  const horarios = (sede.horarios ?? {}) as HorariosMap;
  const { dia, hhmm } = nowInTz(sede.tz ?? "America/Bogota");
  const ventanas = horarios[dia] ?? [];
  if (ventanas.length === 0 || !ventanas.some((v) => dentroDeVentana(hhmm, v))) {
    throw new Error(`Estamos fuera de horario en "${sede.nombre}" (hoy: ${describeVentanas(ventanas)}). Vuelve más tarde o escríbenos por WhatsApp.`);
  }
}

async function isStaffUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["super_admin", "editor"]);
  return (data?.length ?? 0) > 0;
}

function toNum(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function resolvePedidoProductId(menu: RpMenuData, productogeneralId: number): number {
  const productos = Array.isArray(menu.data) ? menu.data : [];
  const raw = productos.find((p: RpProducto) => toNum(p.productogeneral_id ?? p.producto_id) === productogeneralId);
  if (!raw) return productogeneralId;
  const presentaciones = Array.isArray(raw.lista_presentacion)
    ? (raw.lista_presentacion as Record<string, unknown>[])
    : [];
  return toNum(raw.producto_id ?? presentaciones[0]?.producto_id ?? raw.productogeneral_id, productogeneralId);
}

/**
 * Resuelve sede + productos, recalcula precios server-side (no confía en el cliente)
 * y arma el detalle del pedido.
 */
async function resolveOrder(input: CheckoutInput): Promise<{
  sede: SedeRow;
  detalle: DetallePedido[];
  subtotal: number;
  total: number;
}> {
  // 1) Sede + validación de horarios y banderas RP (FASE 3)
  const { data: sedeRaw, error: sedeErr } = await supabaseAdmin
    .from("sedes")
    .select(
      "id, nombre, rp_local_id, horarios, tz, kill_switch, rp_local_estado, rp_acepta_delivery",
    )
    .eq("id", input.sedeId)
    .maybeSingle();
  if (sedeErr) throw new Error(sedeErr.message);
  if (!sedeRaw) throw new Error("Sede no encontrada");
  const sede = sedeRaw as SedeRow & {
    horarios: HorariosMap | null;
    tz: string | null;
    kill_switch: boolean | null;
    rp_local_estado: number | null;
    rp_acepta_delivery: number | null;
  };
  if (!sede.rp_local_id)
    throw new Error(`La sede "${sede.nombre}" no tiene rp_local_id asignado`);

  const staffBypass = await isStaffUser(input.userId);
  assertSedeOperativa(sede, input.tipo, { bypass: staffBypass });
  if (staffBypass) {
    // Traza de pedidos de prueba para que no se confundan con tráfico real.
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "order_test_mode",
      sede_id: sede.id,
      ok: true,
      mensaje: `Bypass de horario/kill_switch por staff (user_id=${input.userId ?? "?"})`,
      payload: { tipo: input.tipo } as never,
    });
  }

  // 2) Productos master
  const productIds = Array.from(new Set(input.items.map((i) => i.productoId)));
  const { data: prods, error: prodErr } = await supabaseAdmin
    .from("productos_master")
    .select("id, rp_id, almacen_id, nombre, precio, modificadores")
    .in("id", productIds);
  if (prodErr) throw new Error(prodErr.message);
  const prodMap = new Map<string, ProductoMasterRow>(
    ((prods ?? []) as ProductoMasterRow[]).map((p) => [p.id, p]),
  );
  for (const id of productIds) {
    if (!prodMap.has(id)) throw new Error(`Producto ${id} no disponible`);
  }

  // 3) Overrides per-sede para precio
  const { data: overrides } = await supabaseAdmin
    .from("sede_producto_overrides")
    .select("producto_id, precio_override, disponible")
    .eq("sede_id", sede.id)
    .in("producto_id", productIds);
  const ovrMap = new Map<string, { precio_override: number | null; disponible: boolean }>(
    ((overrides ?? []) as { producto_id: string; precio_override: number | null; disponible: boolean }[]).map(
      (o) => [o.producto_id, { precio_override: o.precio_override, disponible: o.disponible }],
    ),
  );
  for (const id of productIds) {
    const o = ovrMap.get(id);
    if (o && !o.disponible) {
      const p = prodMap.get(id)!;
      throw new Error(`"${p.nombre}" no está disponible en esta sede`);
    }
  }

  // 4) Armar detalle con precios recalculados
  const catalogo = await rpGetCatalogo(sede.rp_local_id);
  let subtotal = 0;
  const detalle: DetallePedido[] = input.items.map((it) => {
    const p = prodMap.get(it.productoId)!;
    const ovr = ovrMap.get(it.productoId);
    const precioBase = toNum(ovr?.precio_override ?? p.precio);

    const grupos = (Array.isArray(p.modificadores) ? p.modificadores : []) as ModGroup[];
    const mods: DetallePedido["modificadores"] = [];
    let extra = 0;
    for (const m of it.modificadores ?? []) {
      const grupo = grupos.find((g) => g.id === m.grupoId);
      const opcion = grupo?.opciones.find((o) => o.id === m.opcionId);
      if (!opcion) continue; // descarta silenciosamente modificadores inválidos
      mods.push({
        grupoId: m.grupoId,
        opcionId: m.opcionId,
        nombre: opcion.nombre,
        precio: toNum(opcion.precio),
      });
      extra += toNum(opcion.precio);
    }

    const precio_unitario = precioBase + extra;
    const sub = precio_unitario * it.cantidad;
    subtotal += sub;
    return {
      productoId: p.id,
      nombre: p.nombre,
      rp_id: p.rp_id,
      pedido_productoid: resolvePedidoProductId(catalogo, p.rp_id),
      almacen_id: p.almacen_id,
      cantidad: it.cantidad,
      precio_unitario,
      subtotal: sub,
      modificadores: mods,
    };
  });

  return { sede, detalle, subtotal, total: subtotal };
}

/**
 * Envía el pedido a Restaurant.pe y persiste la copia local en public.orders.
 * Devuelve el id de pedido devuelto por el POS (o el id local si Restaurant.pe
 * responde sin id pero el envío fue exitoso).
 */
export async function submitOrder(input: CheckoutInput): Promise<{
  orderId: string;
  localId: string;
  rpPedidoId: string | null;
  subtotal: number;
  total: number;
}> {
  const { sede, detalle, subtotal, total } = await resolveOrder(input);

  // 1) Insertar registro local PRIMERO para tener UUID que sirva como
  //    delivery_codigointegracion (antiduplica en el POS, Swagger V2).
  const itemsSnapshot = detalle.map((d) => ({
    productoId: d.productoId,
    nombre: d.nombre,
    cantidad: d.cantidad,
    precio: d.precio_unitario,
    modificadores: d.modificadores,
  }));
  const { data: orderRow, error: insErr } = await supabaseAdmin
    .from("orders")
    .insert({
      user_id: input.userId ?? null,
      sede_id: sede.id,
      rp_payload: {} as unknown as Json,
      status: "enviado",
      tipo: input.tipo,
      pago: input.pago,
      cliente: input.cliente as unknown as Json,
      items: itemsSnapshot as unknown as Json,
      subtotal,
      total,
      notas: input.notas ?? null,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(`No se pudo guardar el pedido: ${insErr.message}`);
  const localId = (orderRow as { id: string }).id;

  // 2) Payload Restaurant.pe — alineado al Swagger V2 oficial (2-oas3).
  //    Notas:
  //    - `delivery_codigointegracion` = UUID local → idempotencia en el POS.
  //    - `cliente_tipo: 0` = persona natural (1 = empresa).
  //    - `validacion_cliente: 4` = validar por teléfono (lo único que pedimos).
  //    - `delivery_comprobante: 1` = boleta por defecto.
  //    Pago: 1=efectivo, 2=tarjeta presencial, 5=online (Swagger V2).
  const tipoPago = input.pago === "efectivo" ? 1 : input.pago === "datafono" ? 2 : 5;
  const sedeLatLng = sede as unknown as { lat: number | null; lng: number | null };
  // Feature flag para habilitar el push socket de Restaurant.pe → QuipuPOS del local.
  // En producción debe configurarse: RP_EMIT_SOCKET=true
  // Rollback sin cambio de código: RP_EMIT_SOCKET=false (puede requerir reinicio del runtime).
  const emitSocket = process.env.RP_EMIT_SOCKET === "true";
  const payload = {
    delivery: {
      local_id: sede.rp_local_id,
      canaldelivery_id: 1,
      delivery_pagocon: input.pago === "efectivo" ? total : 0,
      delivery_montodescuento: 0,
      delivery_tipopago: tipoPago,
      tarjeta_id: input.pago === "datafono" ? 1 : null,
      delivery_modalidad: input.tipo === "delivery" ? 1 : 2,
      delivery_direccionenvio: input.cliente.direccion ?? "",
      delivery_referencia: input.cliente.detalles ?? "",
      delivery_observacion: input.notas ?? "",
      delivery_notageneral: input.notas ?? "",
      delivery_comprobante: 1,
      delivery_codigointegracion: localId,
      ...(sedeLatLng.lat != null ? { delivery_latitud: String(sedeLatLng.lat) } : {}),
      ...(sedeLatLng.lng != null ? { delivery_longitud: String(sedeLatLng.lng) } : {}),
      emitSocket,
    },
    cliente: {
      cliente_nombres: input.cliente.nombre,
      cliente_apellidos: "",
      cliente_dniruc: "",
      cliente_direccion: input.cliente.direccion ?? "",
      cliente_telefono: input.cliente.telefono,
      cliente_email: "",
      cliente_observacion: input.notas ?? "",
      cliente_tipo: 0,
      validacion_cliente: 4,
    },
    listaPedidos: detalle.map((d) => ({
      pedido_productoid: d.pedido_productoid,
      pedido_cantidad: d.cantidad,
      pedido_precio: d.precio_unitario.toFixed(2),
      pedido_observacion: "",
    })),
  };

  // 3) Llamar a Restaurant.pe.
  let rpResponse: unknown = null;
  let rpPedidoId: string | null = null;
  let rpDeliveryId: string | null = null;
  let rpNumeroComanda: string | null = null;
  let rpCabecera: unknown = null;
  try {
    rpResponse = await rpRegistrarDelivery(payload);
    if (typeof rpResponse === "number" || typeof rpResponse === "string") {
      const s = String(rpResponse).trim();
      if (s) rpPedidoId = s;
    } else {
      const r = (rpResponse ?? {}) as Record<string, unknown>;
      const data = (r.data as Record<string, unknown> | undefined) ?? undefined;
      const delivery = (r.delivery as Record<string, unknown> | undefined) ?? undefined;

      // Candidatos para delivery_id (lo que RP usa en webhooks).
      const deliveryCandidates = [
        r.delivery_id,
        r.deliveryId,
        data?.delivery_id,
        data?.deliveryId,
        delivery?.delivery_id,
        delivery?.id,
      ];
      for (const c of deliveryCandidates) {
        if (c != null && String(c).trim() !== "") {
          rpDeliveryId = String(c);
          break;
        }
      }

      // Candidatos para pedido_id (legacy / comanda interna).
      const pedidoCandidates = [
        r.pedido_id,
        r.id,
        r.comanda,
        r.numero,
        r.numero_pedido,
        data?.pedido_id,
        data?.id,
      ];
      for (const c of pedidoCandidates) {
        if (c != null && String(c).trim() !== "") {
          rpPedidoId = String(c);
          break;
        }
      }

      // Si encontramos delivery_id explícito, lo preferimos como rp_pedido_id
      // (columna que el resolver del webhook ya consulta).
      if (rpDeliveryId) rpPedidoId = rpDeliveryId;
    }

    // Normalizamos rp_response como objeto JSON estructurado. Guardamos IDs
    // separados para no perder información de correlación.
    const rpResponseObj = {
      rp_pedido_id: rpPedidoId,
      rp_delivery_id: rpDeliveryId,
      rp_numero_comanda: rpNumeroComanda,
      delivery_codigointegracion: localId,
      registered_at: new Date().toISOString(),
      raw_pos_response: rpResponse,
    };

    await supabaseAdmin
      .from("orders")
      .update({
        rp_pedido_id: rpPedidoId,
        rp_numero_comanda: rpNumeroComanda,
        rp_payload: payload as unknown as Json,
        rp_response: rpResponseObj as unknown as Json,
        status: "enviado",
      })
      .eq("id", localId);

    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "order",
      sede_id: sede.id,
      payload: {
        request: payload,
        response: rpResponse,
        cabecera: rpCabecera,
        order_id: localId,
        emitSocket,
      } as unknown as Json,
      ok: true,
      mensaje: `Pedido enviado a Restaurant.pe (rp_pedido_id=${rpPedidoId ?? "n/d"}, comanda=${rpNumeroComanda ?? "n/d"}, emitSocket=${emitSocket})`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("orders")
      .update({
        status: "error",
        rp_response: { error: msg } as Json,
      })
      .eq("id", localId);
    await supabaseAdmin.from("rp_sync_log").insert({
      tipo: "order",
      sede_id: sede.id,
      payload: { request: payload, order_id: localId, error: msg } as unknown as Json,
      ok: false,
      mensaje: `Fallo al enviar pedido a Restaurant.pe: ${msg}`,
    });
    throw new Error(
      "No pudimos enviar tu pedido al sistema de la sede. Intenta de nuevo o contáctanos por WhatsApp.",
    );
  }

  return {
    orderId: localId,
    localId,
    rpPedidoId,
    subtotal,
    total,
  };
}
