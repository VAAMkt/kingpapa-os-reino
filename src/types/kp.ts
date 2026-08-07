import type { Clan } from "@/lib/loyalty-model";

// KINGPAPA OS — Domain types
// TODO: Reemplazar mocks por respuestas reales del backend cuando exista.

export type Ciudad = "Cali" | "Bogotá" | "Jamundí" | "Medellín";

export type OrderChannel = "web" | "whatsapp" | "rappi" | "didi" | "pickup" | "qr-mesa";

export type Ocasion =
  | "parche"
  | "after-rumba"
  | "almuerzo-obrero"
  | "familia"
  | "antojo-mortal"
  | "solo";

export interface ModificadorOpcion {
  id: number;
  nombre: string;
  precio: number;
}

export interface ModificadorGrupo {
  id: number;
  nombre: string;
  min: number;
  max: number;
  opciones: ModificadorOpcion[];
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  imagen: string;
  pesoAprox: string;
  precioDesde: number;
  nivelHambre: 1 | 2 | 3 | 4 | 5;
  nivelPicante: 0 | 1 | 2 | 3;
  ocasiones: Ocasion[];
  categorias: string[];
  paraCompartir: boolean;
  esNuevo?: boolean;
  esMasVendido?: boolean;
  esRecomendado?: boolean;
  destacado?: boolean;
  etiquetaCustom?: string | null;
  etiqueta_custom?: string | null;
  clasificacion_me?: string | null;
  conArroz?: boolean;
  esBowl?: boolean;
  esEconomico?: boolean;
  modificadores?: ModificadorGrupo[];
}

export interface Categoria {
  id: string;
  nombre: string;
  filtro: string; // chip label
  orden?: number;
}

export interface Sede {
  id: string;
  nombre: string;
  ciudad: Ciudad;
  direccion: string;
  barrio?: string;
  mall?: string;
  horario: string;
  abiertaAhora: boolean;
  delivery: boolean;
  pickup: boolean;
  qrMesa: boolean;
  whatsapp?: string;
  mapsUrl?: string;
}

export type CategoriaHistoria =
  | "Retos"
  | "Festivales"
  | "Cultura interna"
  | "Fans"
  | "Sostenibilidad"
  | "Franquicias"
  | "Nuevas sedes";

export interface Historia {
  id: string;
  slug: string;
  titulo: string;
  categoria: CategoriaHistoria;
  extracto: string;
  fecha: string; // ISO (YYYY-MM-DD)
  imagen: string;
  videoUrl?: string;
  link?: string; // URL original (kingpapacali.com)
  contenidoHtml?: string; // HTML completo del post
}

export interface QuizQuestion {
  id: string;
  pregunta: string;
  opciones: { id: string; label: string; emoji?: string }[];
  // TODO: cada respuesta alimenta el zero-party profile del súbdito
  campo: "hambre" | "picante" | "presupuesto" | "ocasion" | "ciudad" | "canal" | "producto";
}

export type Arquetipo = Clan;

export interface Subdito {
  id?: string;
  email?: string;
  whatsapp?: string;
  ciudad?: Ciudad;
  arquetipo?: Clan;
  respuestas: Record<string, string>;
  createdAt: string;
}

// LeadFranquicia deprecated: el flujo de franquicia ahora vive en el Ops Hub.
// Ver src/components/kp/LeadFormFranquicia.tsx + src/lib/ops-hub.ts.
