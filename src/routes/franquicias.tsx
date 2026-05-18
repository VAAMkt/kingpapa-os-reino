import { createFileRoute } from "@tanstack/react-router";
import { BrutalCard, BrutalBadge, SectionHeading } from "@/components/ui-kp/Brutal";
import { BrutalLink } from "@/components/ui-kp/BrutalButton";
import { LeadFormFranquicia } from "@/components/kp/LeadFormFranquicia";

export const Route = createFileRoute("/franquicias")({
  head: () => ({
    meta: [
      { title: "Franquicias KINGPAPA — Sé pionero del Reino BIC" },
      { name: "description", content: "15 sedes en menos de 5 años, comunidad digital de +3M y meta de 50 puntos a 2030. Aplica para abrir tu KINGPAPA y crecer con una marca SAS BIC con tracción brutal." },
      { property: "og:title", content: "Franquicias KINGPAPA — Sé pionero del Reino" },
      { property: "og:description", content: "Marca BIC con la comunidad digital más grande de un restaurante en Colombia. Inversión desde $200M, retorno promedio 26 meses." },
      { property: "og:url", content: "https://kingpapa-os-reino.lovable.app/franquicias" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://kingpapa-os-reino.lovable.app/franquicias" }],
  }),
  component: FranquiciasPage,
});

function FranquiciasPage() {
  return (
    <>
      {/* HERO */}
      <section className="bg-kp-ink text-kp-cheese border-b-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-12 md:py-20">
          <BrutalBadge tone="yellow">Franquicias KINGPAPA · SAS BIC</BrutalBadge>
          <h1 className="font-display text-5xl md:text-8xl uppercase mt-3 leading-[0.9] text-kp-yellow">
            Expandamos el<br/>Reino juntos
          </h1>
          <p className="mt-5 max-w-2xl text-base md:text-lg">
            Nacimos en 2021 en un garaje del barrio El Limonar. Hoy somos <strong>15 sedes</strong>{" "}
            (10 Cali, 1 Jamundí, 4 Bogotá), una comunidad digital de <strong>+3 millones</strong>{" "}
            de fans y vamos por <strong>50 puntos al 2030</strong>. Esto no es una salchipapería:
            es una plataforma de marca lista para escalar contigo.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <BrutalLink href="#aplicar" variant="primary" size="lg">
              Quiero ser pionero del Reino
            </BrutalLink>
            <BrutalLink href="#inversion" variant="ghost" size="lg">
              Ver inversión
            </BrutalLink>
          </div>
        </div>
      </section>

      {/* TRACCIÓN */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <SectionHeading
          eyebrow="Tracción del Reino"
          title="Números que sí venden"
          description="De domicilios en un garaje a marca con caja, comunidad y roadmap. Esto no es promesa: es histórico operativo."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <BrutalCard tone="yellow" className="p-5">
            <p className="font-display text-5xl">+350k</p>
            <h3 className="font-display text-xl uppercase mt-2">Tickets proyectados 2026</h3>
            <p className="text-sm mt-2">
              49.008 (2021) → 197.224 (2022) → 228.191 (2023) → +280k (2025).
              Crecimientos de +391% y +32,6% en la evolución de la marca.
            </p>
          </BrutalCard>
          <BrutalCard tone="cheese" className="p-5">
            <p className="font-display text-5xl">15</p>
            <h3 className="font-display text-xl uppercase mt-2">Sedes en &lt; 5 años</h3>
            <p className="text-sm mt-2">10 en Cali, 1 en Jamundí, 4 en Bogotá. Meta pública: 50 puntos sostenibles al 2030.</p>
          </BrutalCard>
          <BrutalCard tone="purple" className="p-5">
            <p className="font-display text-5xl">+3M</p>
            <h3 className="font-display text-xl uppercase mt-2">Comunidad digital</h3>
            <p className="text-sm mt-2">
              TikTok 1.8M (<strong>#1 restaurante en Colombia</strong>), Instagram 675k,
              YouTube 53k, Facebook activo. La comunidad digital más grande del sector.
            </p>
          </BrutalCard>
          <BrutalCard tone="red" className="p-5">
            <p className="font-display text-5xl">+200</p>
            <h3 className="font-display text-xl uppercase mt-2">Fundaciones apoyadas</h3>
            <p className="text-sm mt-2">Desde el día uno usamos la marca para dar visibilidad a causas locales. Reino con propósito BIC.</p>
          </BrutalCard>
        </div>
      </section>

      {/* POR QUÉ FUNCIONA */}
      <section className="bg-kp-yellow border-y-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
          <SectionHeading eyebrow="Lo que nadie te cuenta" title="Por qué KINGPAPA funciona" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                t: "Marca con comunidad real",
                d: "+3M de fans hiperactivos. Cada apertura se apalanca en audiencias ya construidas: CAC bajo, prueba social masiva y defensa competitiva difícil de copiar.",
                tone: "cheese" as const,
              },
              {
                t: "Experiencia de la realeza",
                d: "Gramajes generosos, calidad sin negociar, atención cercana y productos diseñados para fidelizar. El cliente vuelve y trae parche.",
                tone: "cheese" as const,
              },
              {
                t: "Operación estandarizada",
                d: "Manual de procesos, fichas técnicas, BOH eficiente, centro de abastecimiento y prep < 8 min. Replicable de Cali a Bogotá.",
                tone: "cheese" as const,
              },
              {
                t: "Equipo que ya se quemó",
                d: "Los fundadores vienen de F&B y entretenimiento. Maestría hecha escuchando errores de cientos de restauranteros antes de lanzar KINGPAPA.",
                tone: "cheese" as const,
              },
            ].map((c) => (
              <BrutalCard key={c.t} tone={c.tone} className="p-5">
                <h3 className="font-display text-2xl uppercase">{c.t}</h3>
                <p className="text-sm mt-2">{c.d}</p>
              </BrutalCard>
            ))}
          </div>
        </div>
      </section>

      {/* INVERSIÓN Y CONDICIONES */}
      <section id="inversion" className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <SectionHeading
          eyebrow="Inversión y condiciones"
          title="Beneficios solo para pioneros"
          description="Las cifras de abajo aplican a los primeros franquiciados que entren a esta ola de expansión. Después suben a condiciones estándar."
        />
        <div className="mb-4">
          <BrutalBadge tone="red">Tarifa pionero · cupos limitados</BrutalBadge>
        </div>
        <BrutalCard tone="cheese" className="p-5 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { k: "Canon de entrada", v: "$50M", s: "COP + IVA" },
              { k: "Inversión inicial", v: "~$200M", s: "COP (incluye derecho de marca)" },
              { k: "Inventario inicial", v: "~$10M", s: "COP" },
              { k: "Regalías", v: "2,5%", s: "Pionero · normal 3%" },
              { k: "Publicidad", v: "2,5%", s: "Pionero · normal 3%" },
              { k: "Duración contrato", v: "6 años", s: "Pionero · normal 5" },
              { k: "Retorno promedio", v: "26 meses", s: "Sobre operación tipo" },
              { k: "Soporte", v: "360°", s: "Local, training, lanzamiento, marketing" },
            ].map((x) => (
              <div key={x.k} className="border-2 border-kp-ink p-4 bg-kp-yellow">
                <p className="font-display text-xs uppercase tracking-wide">{x.k}</p>
                <p className="font-display text-3xl md:text-4xl mt-1">{x.v}</p>
                <p className="text-xs mt-1 text-kp-ink/70">{x.s}</p>
              </div>
            ))}
          </div>
        </BrutalCard>
      </section>

      {/* MAPA DE EXPANSIÓN */}
      <section className="bg-kp-cheese border-y-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
          <SectionHeading eyebrow="Futuro del Reino" title="Mapa de expansión" />
          <BrutalCard tone="yellow" className="p-5 md:p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { c: "Cali", e: "10 sedes activas", t: "lime" as const },
                { c: "Jamundí", e: "1 sede activa", t: "lime" as const },
                { c: "Bogotá", e: "4 sedes activas", t: "lime" as const },
                { c: "Medellín", e: "Buscando pionero", t: "red" as const },
                { c: "Barranquilla", e: "Buscando pionero", t: "red" as const },
                { c: "Pereira", e: "Buscando pionero", t: "red" as const },
                { c: "Bucaramanga", e: "Buscando pionero", t: "red" as const },
                { c: "Meta 2030", e: "50 puntos del Reino", t: "purple" as const },
              ].map((x) => (
                <div key={x.c} className="border-2 border-kp-ink p-3 text-center bg-kp-cheese">
                  <p className="font-display text-2xl uppercase">{x.c}</p>
                  <BrutalBadge tone={x.t} className="mt-2">{x.e}</BrutalBadge>
                </div>
              ))}
            </div>
          </BrutalCard>
        </div>
      </section>

      {/* HISTORIA / DESARMA OBJECIONES */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <SectionHeading
          eyebrow="Historia que desarma objeciones"
          title="Del garaje al Reino"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BrutalCard tone="black" className="p-5">
            <p className="font-display text-4xl text-kp-yellow">2021</p>
            <h3 className="font-display text-xl uppercase mt-2">Nace en un garaje</h3>
            <p className="text-sm mt-2">El Limonar, Cali. Solo domicilios. Cero pretensión, todo hambre brava.</p>
          </BrutalCard>
          <BrutalCard tone="black" className="p-5">
            <p className="font-display text-4xl text-kp-yellow">2023–2025</p>
            <h3 className="font-display text-xl uppercase mt-2">Explosión nacional</h3>
            <p className="text-sm mt-2">Salto a Bogotá, primer puesto en TikTok entre restaurantes colombianos y +280k tickets/año.</p>
          </BrutalCard>
          <BrutalCard tone="black" className="p-5">
            <p className="font-display text-4xl text-kp-yellow">2030</p>
            <h3 className="font-display text-xl uppercase mt-2">50 sedes del Reino</h3>
            <p className="text-sm mt-2">Modelo mixto franquicias + puntos propios. Roadmap público, no humo.</p>
          </BrutalCard>
        </div>
      </section>

      {/* PROCESO */}
      <section className="bg-kp-purple text-kp-cheese border-y-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
          <div className="mb-6 md:mb-10">
            <span className="inline-block bg-kp-yellow text-kp-ink font-display uppercase tracking-widest text-xs px-3 py-1 mb-3">
              Cómo aplicar
            </span>
            <h2 className="font-display text-4xl md:text-6xl uppercase leading-none text-kp-yellow">
              5 pasos para coronarte
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { n: "01", t: "Postulación", d: "Llenas el formulario de abajo. 3 minutos." },
              { n: "02", t: "Aplicación formal", d: "Te enviamos el dossier completo y validamos perfil." },
              { n: "03", t: "Verificación", d: "Informe de capacidad financiera y operativa." },
              { n: "04", t: "Entrevistas", d: "Conoces a la BANDA fundadora y al equipo de expansión." },
              { n: "05", t: "Contrato", d: "Firmamos, agendamos training y arrancamos apertura." },
            ].map((s) => (
              <BrutalCard key={s.n} tone="cheese" className="p-5">
                <p className="font-display text-4xl text-kp-red">{s.n}</p>
                <h3 className="font-display text-xl uppercase mt-2">{s.t}</h3>
                <p className="text-sm mt-2">{s.d}</p>
              </BrutalCard>
            ))}
          </div>
        </div>
      </section>

      {/* LEAD FORM */}
      <section id="aplicar" className="mx-auto max-w-3xl px-4 md:px-6 py-12">
        <LeadFormFranquicia />
        <div className="mt-6 text-center">
          <p className="text-sm text-kp-ink/80">¿Prefieres escribirnos directo?</p>
          <p className="font-display uppercase mt-1">
            <a href="mailto:kingpapacali@gmail.com" className="underline decoration-2 underline-offset-4">
              kingpapacali@gmail.com
            </a>
            {" · "}
            <a
              href="https://api.whatsapp.com/send/?phone=573172455336&text&type=phone_number&app_absent=0"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-2 underline-offset-4"
            >
              WhatsApp +57 317 2455336
            </a>
          </p>
        </div>
      </section>

      {/* IMPACTO BIC */}
      <section className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <SectionHeading
          eyebrow="Cultura BIC"
          title="Impacto del Reino"
          description="Somos SAS BIC en Cámara. Nuestro propósito declara valor para clientes, colaboradores, proveedores, comunidad e inversionistas."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BrutalCard tone="purple" className="p-5">
            <h3 className="font-display text-2xl uppercase">Stakeholders del Reino</h3>
            <p className="text-sm mt-2">
              Clientes, colaboradores, proveedores, comunidad e inversionistas: un Reino donde todos GANEMOS.
              Gobernanza responsable, no postureo.
            </p>
          </BrutalCard>
          <BrutalCard tone="purple" className="p-5">
            <h3 className="font-display text-2xl uppercase">Talento que sostiene la corona</h3>
            <p className="text-sm mt-2">
              Los colaboradores son el motor del Reino. Capacitación constante, plan carrera y un círculo virtuoso:
              colaborador feliz → cliente exaltado → marca que evoluciona.
            </p>
          </BrutalCard>
          <BrutalCard tone="purple" className="p-5">
            <h3 className="font-display text-2xl uppercase">Comunidad y causas</h3>
            <p className="text-sm mt-2">
              +200 fundaciones apoyadas desde el inicio. Usamos la comunidad digital más grande del sector
              para amplificar causas locales que merecen ser vistas.
            </p>
          </BrutalCard>
        </div>
      </section>

      {/* TESIS PARA EL INVERSOR */}
      <section className="bg-kp-ink text-kp-cheese border-t-4 border-kp-ink">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-12 md:py-16">
          <BrutalBadge tone="yellow">Tesis para el inversor</BrutalBadge>
          <h2 className="font-display text-4xl md:text-6xl uppercase leading-none text-kp-yellow mt-3">
            Por qué entrar ahora
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <BrutalCard tone="cheese" className="p-5">
              <p className="font-display text-3xl">01 · Tracción brutal</p>
              <p className="text-sm mt-2">
                15 sedes en menos de 5 años desde un garaje. Tickets multiplicados x7 entre 2021 y 2025.
              </p>
            </BrutalCard>
            <BrutalCard tone="cheese" className="p-5">
              <p className="font-display text-3xl">02 · Demanda probada</p>
              <p className="text-sm mt-2">
                Ratings altos en apps, productos de ticket medio-alto y gramajes generosos que fidelizan.
                No vendemos papas: vendemos pertenecer al Reino.
              </p>
            </BrutalCard>
            <BrutalCard tone="cheese" className="p-5">
              <p className="font-display text-3xl">03 · Propósito BIC</p>
              <p className="text-sm mt-2">
                Roadmap claro a 50 puntos sostenibles al 2030, modelo mixto franquicia + propio,
                con declaración de impacto registrada.
              </p>
            </BrutalCard>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <BrutalLink href="#aplicar" variant="primary" size="lg">
              Aplicar a franquicia
            </BrutalLink>
            <BrutalLink href="https://www.tiktok.com/@kingpapaco" variant="ghost" size="lg">
              Ver la comunidad en TikTok
            </BrutalLink>
          </div>
        </div>
      </section>

      {/* CIERRE EMOCIONAL */}
      <section className="mx-auto max-w-5xl px-4 md:px-6 py-16 text-center">
        <BrutalBadge tone="red">Última palabra</BrutalBadge>
        <h2 className="font-display text-4xl md:text-7xl uppercase leading-[0.95] mt-4">
          El Reino no se hereda.<br/>
          <span className="text-kp-red">Se conquista.</span>
        </h2>
        <p className="mt-4 text-base md:text-lg max-w-2xl mx-auto">
          Los pioneros de hoy son las leyendas de 2030. Si crees que tu ciudad merece KINGPAPA,
          este es el momento de levantar la corona.
        </p>
        <div className="mt-6 flex justify-center">
          <BrutalLink href="#aplicar" variant="primary" size="lg">
            Aplicar para franquicia
          </BrutalLink>
        </div>
      </section>
    </>
  );
}
