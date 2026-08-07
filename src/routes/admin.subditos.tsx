import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrutalCard, BrutalBadge } from "@/components/ui-kp/Brutal";
import { BrutalButton } from "@/components/ui-kp/BrutalButton";
import { listSubditos } from "@/lib/admin-stats.functions";

export const Route = createFileRoute("/admin/subditos")({
  head: () => ({ meta: [{ title: "Creyentes — Admin KINGPAPA" }] }),
  component: SubditosPage,
});

function SubditosPage() {
  const listFn = useServerFn(listSubditos);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-subditos", term],
    queryFn: () => listFn({ data: { search: term || undefined } }),
  });

  function exportCsv() {
    const rows = data ?? [];
    const header = ["fecha", "email", "whatsapp", "arquetipo", "ciudad", "source"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          new Date((r as { created_at: string }).created_at).toISOString(),
          (r as { email: string | null }).email ?? "",
          (r as { whatsapp: string | null }).whatsapp ?? "",
          (r as { arquetipo: string | null }).arquetipo ?? "",
          (r as { ciudad: string | null }).ciudad ?? "",
          (r as { source: string }).source,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subditos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <BrutalBadge tone="yellow">Creyentes</BrutalBadge>
          <h1 className="font-display text-4xl uppercase mt-2">La banda</h1>
          <p className="text-xs text-kp-ink/60">{data?.length ?? 0} registrados</p>
        </div>
        <BrutalButton onClick={exportCsv} variant="dark">
          Export CSV
        </BrutalButton>
      </header>

      <div className="flex gap-2">
        <input
          className="flex-1 border-2 border-kp-ink px-3 py-2 bg-white"
          placeholder="Buscar email, WhatsApp, ciudad o arquetipo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <BrutalButton onClick={() => setTerm(search)}>Buscar</BrutalButton>
      </div>

      <BrutalCard tone="cheese" className="p-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase font-display">
            <tr className="border-b-2 border-kp-ink">
              <th className="text-left py-2">Fecha</th>
              <th className="text-left py-2">Email</th>
              <th className="text-left py-2">WhatsApp</th>
              <th className="text-left py-2">Arquetipo</th>
              <th className="text-left py-2">Ciudad</th>
              <th className="text-left py-2">Fuente</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => {
              const row = r as {
                id: string;
                created_at: string;
                email: string | null;
                whatsapp: string | null;
                arquetipo: string | null;
                ciudad: string | null;
                source: string;
              };
              return (
                <tr key={row.id} className="border-b border-kp-ink/10">
                  <td className="py-2">
                    {new Date(row.created_at).toLocaleString("es-CO", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-2">{row.email ?? "—"}</td>
                  <td className="py-2">{row.whatsapp ?? "—"}</td>
                  <td className="py-2 uppercase font-display text-xs">{row.arquetipo ?? "—"}</td>
                  <td className="py-2">{row.ciudad ?? "—"}</td>
                  <td className="py-2 text-xs">{row.source}</td>
                </tr>
              );
            })}
            {(data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-kp-ink/60">
                  Todavía nadie se ha unido a la banda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </BrutalCard>
    </div>
  );
}
