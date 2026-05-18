// TODO: reemplazar por CMS / API /api/historias
import type { Historia } from "@/types/kp";
import sharePlatter from "@/assets/share-platter.jpg";
import hero from "@/assets/hero-salchipapa.jpg";
import bowl from "@/assets/bowl-samba.jpg";
import callejera from "@/assets/kingcallejera.jpg";
import charron from "@/assets/kingcharron.jpg";

export const historias: Historia[] = [
  {
    id: "reto-3kg",
    titulo: "El Reto de los 3.5kg: nadie sobrevive solo",
    categoria: "Retos",
    extracto: "Cinco súbditos lo intentaron. Ninguno terminó. El que más se acercó: 2.1kg en 28 minutos.",
    fecha: "2025-09-01",
    imagen: hero,
    videoUrl: "https://www.tiktok.com/",
  },
  {
    id: "kingpapa-fest-2025",
    titulo: "KINGPAPA Fest 2025: salsa, salchipapa y locura",
    categoria: "Festivales",
    extracto: "12 horas, 4 tarimas, papas infinitas. Cali se volvió el Reino.",
    fecha: "2025-08-15",
    imagen: sharePlatter,
  },
  {
    id: "fan-tatuaje",
    titulo: "Andrea se tatuó la corona y se ganó papas de por vida",
    categoria: "Fans",
    extracto: "Sí, leíste bien. Y la promo sigue activa. Bajo tu cuenta y riesgo.",
    fecha: "2025-07-21",
    imagen: callejera,
  },
  {
    id: "nueva-sede-poblado",
    titulo: "Abrimos en Medallo: KINGPAPA Poblado",
    categoria: "Nuevas sedes",
    extracto: "El Reino ya tiene castillo paisa. Y sí, el queso también se derrite igual.",
    fecha: "2025-06-10",
    imagen: charron,
  },
  {
    id: "bowl-launch",
    titulo: "Nace el SAMBA Bowl",
    categoria: "Cultura interna",
    extracto: "Nuestro chef llevó 2 meses puliendo el balance entre arroz, chorizo y salsa de la casa.",
    fecha: "2025-05-22",
    imagen: bowl,
  },
  {
    id: "boda-salchipapera",
    titulo: "Boda salchipapera: dos súbditos se coronaron",
    categoria: "Festivales",
    extracto: "Mesa principal: 12kg de salchipapa. Torta: pirámide de papas.",
    fecha: "2025-04-12",
    imagen: sharePlatter,
  },
];
