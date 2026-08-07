export const CLANS = [
  "Legión de Acero",
  "Tripulación del After",
  "Iluminado de la Fórmula",
] as const;

export type Clan = (typeof CLANS)[number];

export const CLAN_COPY: Record<Clan, string> = {
  "Legión de Acero":
    "Carácter inquebrantable, cero porciones pequeñas y madera para liderar a la banda.",
  "Tripulación del After":
    "Alma libre y magnética: conviertes cualquier salida en un ritual legendario con el parche.",
  "Iluminado de la Fórmula":
    "Paladar de élite y mente estratégica: encuentras la fórmula exacta detrás de cada sabor.",
};

const ANSWER_CLAN: Record<string, Clan> = {
  "hambre:1": "Iluminado de la Fórmula",
  "hambre:3": "Tripulación del After",
  "hambre:5": "Legión de Acero",
  "picante:0": "Iluminado de la Fórmula",
  "picante:1": "Tripulación del After",
  "picante:3": "Legión de Acero",
  "ocasion:parche": "Tripulación del After",
  "ocasion:after-rumba": "Tripulación del After",
  "ocasion:almuerzo-obrero": "Legión de Acero",
  "ocasion:familia": "Iluminado de la Fórmula",
  "ocasion:antojo-mortal": "Iluminado de la Fórmula",
  "presupuesto:bajo": "Iluminado de la Fórmula",
  "presupuesto:medio": "Tripulación del After",
  "presupuesto:alto": "Legión de Acero",
  "canal:web": "Iluminado de la Fórmula",
  "canal:whatsapp": "Tripulación del After",
  "canal:rappi": "Tripulación del After",
  "canal:didi": "Tripulación del After",
  "canal:pickup": "Legión de Acero",
};

export function calculateClan(answers: Record<string, string>): Clan {
  const scores = Object.fromEntries(CLANS.map((clan) => [clan, 0])) as Record<Clan, number>;
  for (const [question, answer] of Object.entries(answers)) {
    const clan = ANSWER_CLAN[`${question}:${answer}`];
    if (clan) scores[clan] += 1;
  }
  const occasionClan = ANSWER_CLAN[`ocasion:${answers.ocasion}`] ?? CLANS[0];
  return CLANS.reduce(
    (winner, clan) => (scores[clan] > scores[winner] ? clan : winner),
    occasionClan,
  );
}

export const LOYALTY_RANKS = [
  { name: "Postulante", band: "Blanca", minOrders: 0 },
  { name: "Iniciado", band: "Amarilla", minOrders: 3 },
  { name: "Militante", band: "Naranja", minOrders: 6 },
  { name: "Guardián", band: "Verde", minOrders: 12 },
  { name: "Consagrado", band: "Dorada", minOrders: 24 },
] as const;

export function getLoyaltyProgress(completedOrders: number) {
  const orders = Number.isFinite(completedOrders) ? Math.max(0, Math.floor(completedOrders)) : 0;
  let rankIndex = LOYALTY_RANKS.length - 1;
  while (rankIndex > 0 && orders < LOYALTY_RANKS[rankIndex].minOrders) rankIndex -= 1;
  const current = LOYALTY_RANKS[rankIndex];
  const next = LOYALTY_RANKS[rankIndex + 1] ?? null;
  return {
    orders,
    current,
    next,
    remaining: next ? next.minOrders - orders : 0,
    percent: next
      ? Math.round(((orders - current.minOrders) / (next.minOrders - current.minOrders)) * 100)
      : 100,
  };
}
