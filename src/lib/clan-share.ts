import type { Clan } from "@/lib/loyalty-model";

type ClanCardInput = {
  clan: Clan;
  title: string;
  rank: string;
  band: string;
  description: string;
};

function wrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = next;
    }
  }
  context.fillText(line, x, y);
}

export async function shareClanCard(input: ClanCardInput) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tu navegador no pudo crear la tarjeta");

  context.fillStyle = "#FFD600";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#111111";
  context.fillRect(54, 54, 972, 1812);
  context.fillStyle = "#9D00F5";
  context.fillRect(94, 390, 892, 800);

  context.fillStyle = "#FFD600";
  context.font = "900 104px Impact, sans-serif";
  context.fillText("KINGPAPA", 94, 190);
  context.font = "700 42px Arial, sans-serif";
  context.fillText("MI REINO // MI CLAN", 98, 270);

  context.fillStyle = "#FFFFFF";
  context.font = "700 44px Arial, sans-serif";
  context.fillText("YO SOY", 142, 500);
  context.font = "900 112px Impact, sans-serif";
  wrappedText(context, input.title.toUpperCase(), 142, 660, 790, 126);

  context.fillStyle = "#FFD600";
  context.font = "900 52px Arial, sans-serif";
  wrappedText(context, input.clan.toUpperCase(), 142, 1010, 790, 64);

  context.fillStyle = "#FFD600";
  context.font = "900 48px Arial, sans-serif";
  context.fillText(`RANGO ${input.rank.toUpperCase()}`, 94, 1320);
  context.font = "700 36px Arial, sans-serif";
  context.fillText(`BANDA ${input.band.toUpperCase()}`, 98, 1382);
  context.fillStyle = "#FFFFFF";
  context.font = "500 42px Arial, sans-serif";
  wrappedText(context, input.description, 98, 1490, 870, 58);

  context.fillStyle = "#FFD600";
  context.font = "900 45px Arial, sans-serif";
  context.fillText("KINGPAPA.CO", 94, 1770);
  context.font = "700 28px Arial, sans-serif";
  context.fillText("LOS REYES DE ESTA PENDEJA'", 98, 1820);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("No se pudo crear el PNG"))), "image/png"),
  );
  const file = new File([blob], "mi-clan-kingpapa.png", { type: "image/png" });
  const shareData = {
    files: [file],
    title: `Soy ${input.title} en KINGPAPA`,
    text: `Mi clan es ${input.clan}. ¿Cuál es el tuyo?`,
  };

  if (navigator.share && navigator.canShare?.(shareData)) {
    try {
      await navigator.share(shareData);
      return "shared" as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled" as const;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
  return "downloaded" as const;
}
