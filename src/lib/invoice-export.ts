import type { InvoiceSnapshot } from "../domain/invoices";
import { rupiah, dateTime } from "../domain/business";
type Line = {
  y: number;
  text: string;
  size: number;
  bold: boolean;
  color: string;
  x: number;
  right?: boolean;
};
const width = 1000,
  margin = 68,
  content = width - margin * 2;
export function renderInvoiceCanvas(snapshot: InvoiceSnapshot) {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure)
    throw new Error("Perangkat tidak dapat membuat gambar invoice.");
  const lines: Line[] = [],
    cuts: number[] = [0];
  let y = margin;
  function line(
    text: string,
    size = 22,
    bold = false,
    color = "#203b32",
    x = margin,
    right = false,
  ) {
    lines.push({ y, text, size, bold, color, x, right });
    y += size * 1.5;
    cuts.push(y);
  }
  function paragraph(text: string, size = 22, bold = false, max = content) {
    measure!.font = `${bold ? "600" : "400"} ${size}px Arial, sans-serif`;
    for (const block of text.split(/\r?\n/)) {
      let buffer = "";
      // Split oversized words as well, so long addresses never run off the page.
      for (const word of block.split(/\s+/)) {
        if (!word) continue;
        const next = buffer ? buffer + " " + word : word;
        if (measure!.measureText(next).width <= max) {
          buffer = next;
          continue;
        }
        if (buffer) {
          line(buffer, size, bold);
          buffer = "";
        }
        let part = "";
        for (const char of word) {
          if (measure!.measureText(part + char).width > max && part) {
            line(part, size, bold);
            part = "";
          }
          part += char;
        }
        buffer = part;
      }
      if (buffer) line(buffer, size, bold);
    }
  }
  function gap(size = 20) {
    y += size;
    cuts.push(y);
  }
  function total(label: string, value: number, bold = false, size = 23) {
    const row = y;
    line(label, size, bold);
    lines.push({
      y: row,
      text: rupiah(value),
      size,
      bold,
      color: "#203b32",
      x: width - margin,
      right: true,
    });
  }
  line("INVOICE", 18, true, "#657a70");
  gap(8);
  paragraph(snapshot.store.name, 38, true);
  paragraph(snapshot.store.address, 20);
  paragraph(
    [
      snapshot.store.phone ? "+" + snapshot.store.phone : "",
      snapshot.store.hours,
    ]
      .filter(Boolean)
      .join(" · "),
    19,
  );
  gap();
  paragraph(snapshot.number, 24, true);
  line(dateTime(snapshot.date), 20);
  gap();
  line("DITAGIHKAN KEPADA", 17, true, "#657a70");
  paragraph(snapshot.customerName, 26, true);
  line(
    snapshot.cancelled
      ? "Order dibatalkan"
      : snapshot.balance === 0
        ? "Lunas"
        : "Belum lunas",
    21,
    true,
  );
  gap(24);
  snapshot.items.forEach((item, i) => {
    paragraph(
      `${String(i + 1).padStart(2, "0")}. ${item.description} · ${item.color}`,
      25,
      true,
    );
    paragraph(item.serviceName, 22);
    line("Estimasi " + dateTime(item.dueAt), 19);
    line(rupiah(item.price), 24, true);
    gap(20);
  });
  total("Subtotal", snapshot.subtotal);
  total("Diskon", snapshot.discount);
  gap(8);
  total("Total invoice", snapshot.total, true, 27);
  total("Pembayaran bersih", snapshot.paid);
  gap(8);
  total("Sisa tagihan", snapshot.balance, true, 27);
  gap(28);
  if (snapshot.cancelled)
    paragraph(
      "Order dibatalkan. Angka tagihan mencatat kondisi saat invoice diperbarui.",
      20,
    );
  else if (snapshot.collected) line("Sepatu telah diambil.", 20);
  paragraph(snapshot.store.terms, 20);
  gap();
  paragraph("Terima kasih telah mempercayakan langkah Anda.", 20, true);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.ceil(y + margin);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Gambar invoice tidak dapat dibuat.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = "#24634c";
  ctx.fillRect(margin, 28, 70, 5);
  ctx.textBaseline = "top";
  for (const l of lines) {
    ctx.fillStyle = l.color;
    ctx.font = `${l.bold ? "600" : "400"} ${l.size}px Arial, sans-serif`;
    ctx.textAlign = l.right ? "right" : "left";
    ctx.fillText(l.text, l.x, l.y);
  }
  return { canvas, cuts };
}
function filename(snapshot: InvoiceSnapshot, format: string) {
  return (
    "invoice-" +
    snapshot.number.replace(/[^a-z0-9_-]/gi, "-").slice(0, 80) +
    "." +
    format
  );
}
async function createFile(
  snapshot: InvoiceSnapshot,
  format: "png" | "pdf",
): Promise<File> {
  const { canvas, cuts } = renderInvoiceCanvas(snapshot);
  if (format === "png") {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG tidak dapat dibuat."))),
        "image/png",
      ),
    );
    return new File([blob], filename(snapshot, format), { type: "image/png" });
  }
  const { jsPDF } = await import("jspdf"),
    pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
  const pageWidth = 190,
    maxHeight = 277,
    scale = pageWidth / canvas.width,
    maxPixels = Math.floor(maxHeight / scale);
  let start = 0,
    page = 0;
  while (start < canvas.height) {
    const maxEnd = Math.min(start + maxPixels, canvas.height);
    const end =
      maxEnd === canvas.height
        ? maxEnd
        : cuts.filter((c) => c > start && c <= maxEnd).at(-1) || maxEnd;
    const piece = document.createElement("canvas");
    piece.width = canvas.width;
    piece.height = Math.ceil(end - start);
    piece
      .getContext("2d")!
      .drawImage(
        canvas,
        0,
        start,
        canvas.width,
        end - start,
        0,
        0,
        canvas.width,
        end - start,
      );
    if (page++) pdf.addPage();
    pdf.addImage(
      piece.toDataURL("image/png"),
      "PNG",
      10,
      10,
      pageWidth,
      piece.height * scale,
    );
    start = end;
  }
  pdf.setProperties({
    title: "Invoice " + snapshot.number,
    author: snapshot.store.name,
    subject: "Tagihan layanan",
  });
  return new File([pdf.output("arraybuffer")], filename(snapshot, format), {
    type: "application/pdf",
  });
}
function download(file: File) {
  const url = URL.createObjectURL(file),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function downloadInvoicePNG(snapshot: InvoiceSnapshot) {
  download(await createFile(snapshot, "png"));
}
export async function downloadInvoicePDF(snapshot: InvoiceSnapshot) {
  download(await createFile(snapshot, "pdf"));
}
export async function shareInvoiceFile(
  snapshot: InvoiceSnapshot,
  format: "png" | "pdf",
) {
  const file = await createFile(snapshot, format);
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({
        files: [file],
        title: "Invoice " + snapshot.number,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      download(file);
    }
  } else download(file);
}
