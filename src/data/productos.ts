// @deprecated - mantenido solo para admin.index/dashboard hasta migrar a counts reales. No usar en UI pública.
// TODO: reemplazar por API /api/productos
import type { Producto, Categoria } from "@/types/kp";
import kingcallejera from "@/assets/kingcallejera.jpg";
import kingcharron from "@/assets/kingcharron.jpg";
import bowlSamba from "@/assets/bowl-samba.jpg";
import sharePlatter from "@/assets/share-platter.jpg";
import heroSalchipapa from "@/assets/hero-salchipapa.jpg";

export const categorias: Categoria[] = [
  { id: "all", nombre: "Todas", filtro: "Todas" },
  { id: "uno", nombre: "Para uno", filtro: "Para uno" },
  { id: "compartir", nombre: "Para compartir", filtro: "Para compartir" },
  { id: "arroz", nombre: "Con arroz", filtro: "Con arroz" },
  { id: "picantes", nombre: "Picantes", filtro: "Picantes" },
  { id: "bowls", nombre: "Bowls", filtro: "Bowls" },
  { id: "top", nombre: "Más vendidos", filtro: "Más vendidos" },
  { id: "nuevos", nombre: "Nuevos", filtro: "Nuevos" },
  { id: "after", nombre: "After rumba", filtro: "After rumba" },
  { id: "economico", nombre: "Económicos", filtro: "Económicos" },
];

export const productos: Producto[] = [
  {
    id: "kingcallejera",
    nombre: "KINGCALLEJERA",
    descripcion:
      "Salchipapa callejera con chorizo coronado, salsa rosada, mostaza y queso derretido. Como en la esquina del barrio, pero del Reino.",
    imagen: kingcallejera,
    pesoAprox: "650g",
    precioDesde: 22900,
    nivelHambre: 4,
    nivelPicante: 1,
    ocasiones: ["after-rumba", "parche", "solo"],
    categorias: ["uno", "top", "after"],
    paraCompartir: false,
    esMasVendido: true,
  },
  {
    id: "kingcharron",
    nombre: "KINGCHARRÓN",
    descripcion:
      "Montaña de chicharrón crocante, papas doradas y río de queso amarillo. Brutal. No apta para flojos.",
    imagen: kingcharron,
    pesoAprox: "850g",
    precioDesde: 32900,
    nivelHambre: 5,
    nivelPicante: 0,
    ocasiones: ["antojo-mortal", "parche"],
    categorias: ["uno", "top"],
    paraCompartir: false,
    esMasVendido: true,
  },
  {
    id: "samba-bowl",
    nombre: "SAMBA Bowl",
    descripcion:
      "Bowl coronado con arroz, papas, chorizo, queso fundido y cebollín. Balance entre obrero y rumba.",
    imagen: bowlSamba,
    pesoAprox: "550g",
    precioDesde: 24900,
    nivelHambre: 3,
    nivelPicante: 1,
    ocasiones: ["almuerzo-obrero", "solo"],
    categorias: ["uno", "arroz", "bowls", "economico"],
    paraCompartir: false,
    esBowl: true,
    conArroz: true,
    esEconomico: true,
    esNuevo: true,
  },
  {
    id: "salchipapa-gigante",
    nombre: "Salchipapa Gigante del Reino",
    descripcion:
      "1,8kg de papa, salchicha, chorizo, chicharrón y triple queso. Para 4–6 súbditos con hambre brava.",
    imagen: sharePlatter,
    pesoAprox: "1.8kg",
    precioDesde: 79900,
    nivelHambre: 5,
    nivelPicante: 2,
    ocasiones: ["parche", "familia", "after-rumba"],
    categorias: ["compartir", "top"],
    paraCompartir: true,
    esMasVendido: true,
  },
  {
    id: "reto-kingpapa",
    nombre: "Reto KINGPAPA",
    descripcion:
      "3,5kg. Si te lo comes solo en 30 min: gratis + corona digital + foto en el muro del Reino.",
    imagen: heroSalchipapa,
    pesoAprox: "3.5kg",
    precioDesde: 119900,
    nivelHambre: 5,
    nivelPicante: 3,
    ocasiones: ["antojo-mortal", "parche"],
    categorias: ["compartir", "picantes"],
    paraCompartir: true,
    esNuevo: true,
  },
  {
    id: "bowl-picante",
    nombre: "Bowl Diabla",
    descripcion: "Arroz, chorizo, papas y salsa diabla casera. Para los que se creen muy machos.",
    imagen: bowlSamba,
    pesoAprox: "500g",
    precioDesde: 26900,
    nivelHambre: 3,
    nivelPicante: 3,
    ocasiones: ["after-rumba"],
    categorias: ["bowls", "picantes", "arroz"],
    paraCompartir: false,
    esBowl: true,
    conArroz: true,
  },
];
