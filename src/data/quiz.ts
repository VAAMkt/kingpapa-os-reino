// TODO: enviar respuestas a /api/subditos para alimentar CRM/loyalty
import type { QuizQuestion, Arquetipo } from "@/types/kp";

export const quiz: QuizQuestion[] = [
  {
    id: "hambre",
    pregunta: "¿Qué nivel de hambre traes, papi?",
    campo: "hambre",
    opciones: [
      { id: "1", label: "Antojito", emoji: "😋" },
      { id: "3", label: "Hambre real", emoji: "😤" },
      { id: "5", label: "Hambre brava", emoji: "🔥" },
    ],
  },
  {
    id: "picante",
    pregunta: "¿Qué tan bravo lo quieres?",
    campo: "picante",
    opciones: [
      { id: "0", label: "Nada de picante", emoji: "🥛" },
      { id: "1", label: "Apenas un toque", emoji: "🌶️" },
      { id: "3", label: "Que llore el alma", emoji: "🥵" },
    ],
  },
  {
    id: "ocasion",
    pregunta: "¿En qué parche te imaginas?",
    campo: "ocasion",
    opciones: [
      { id: "parche", label: "Con el parche", emoji: "🍻" },
      { id: "after-rumba", label: "After rumba", emoji: "🌃" },
      { id: "almuerzo-obrero", label: "Almuerzo obrero", emoji: "👷" },
      { id: "familia", label: "Con la familia", emoji: "👨‍👩‍👧" },
      { id: "antojo-mortal", label: "Antojo mortal solo", emoji: "👑" },
    ],
  },
  {
    id: "presupuesto",
    pregunta: "¿Cuánto vas a soltar hoy?",
    campo: "presupuesto",
    opciones: [
      { id: "bajo", label: "Hasta $25k", emoji: "💵" },
      { id: "medio", label: "$25k – $50k", emoji: "💸" },
      { id: "alto", label: "Lo que pida el Reino", emoji: "👑" },
    ],
  },
  {
    id: "ciudad",
    pregunta: "¿Desde qué ciudad reinas?",
    campo: "ciudad",
    opciones: [
      { id: "Cali", label: "Cali" },
      { id: "Bogotá", label: "Bogotá" },
      { id: "Jamundí", label: "Jamundí" },
      { id: "Medellín", label: "Medallo" },
    ],
  },
  {
    id: "canal",
    pregunta: "¿Cómo te gusta pedir?",
    campo: "canal",
    opciones: [
      { id: "web", label: "Web KP" },
      { id: "whatsapp", label: "WhatsApp" },
      { id: "rappi", label: "Rappi" },
      { id: "didi", label: "DiDi" },
      { id: "pickup", label: "Recoger en sede" },
    ],
  },
];

// TODO: lógica de arquetipo más sofisticada en el backend
export function calcularArquetipo(respuestas: Record<string, string>): Arquetipo {
  const ocasion = respuestas.ocasion;
  const picante = parseInt(respuestas.picante || "0", 10);
  const hambre = parseInt(respuestas.hambre || "0", 10);

  if (ocasion === "after-rumba" && picante >= 1) return "El Rumbero";
  if (ocasion === "almuerzo-obrero") return "El Obrero del Reino";
  if (ocasion === "familia") return "El Familiar Mayor";
  if (ocasion === "antojo-mortal" && picante >= 2) return "La Reina del Antojo";
  if (hambre >= 4) return "El Cabezón";
  return "El Cabezón";
}
