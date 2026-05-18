// TODO: reemplazar por API /api/dashboard con datos reales
export const dashboardMock = {
  pedidosHoy: 1284,
  pedidosPorCanal: [
    { canal: "Web KP", valor: 412, color: "kp-yellow" },
    { canal: "WhatsApp", valor: 318, color: "kp-lime" },
    { canal: "Rappi", valor: 296, color: "kp-orange" },
    { canal: "DiDi", valor: 162, color: "kp-red" },
    { canal: "Pickup", valor: 96, color: "kp-purple" },
  ],
  subditosNuevos: 87,
  subditosTotal: 12480,
  sedesTop: [
    { sede: "Granada", pedidos: 312 },
    { sede: "Chipichape", pedidos: 268 },
    { sede: "Sur", pedidos: 219 },
    { sede: "Poblado", pedidos: 198 },
    { sede: "Zona G", pedidos: 164 },
  ],
  productosTop: [
    { producto: "KINGCALLEJERA", vendidos: 412 },
    { producto: "KINGCHARRÓN", vendidos: 298 },
    { producto: "Salchipapa Gigante", vendidos: 184 },
    { producto: "SAMBA Bowl", vendidos: 156 },
  ],
};
