import {
  groupPackingItemsByCategory,
  type PackingItem,
} from "@/lib/packing";

export type PackingExportInput = {
  destination: string;
  startDate: string;
  endDate: string;
  items: PackingItem[];
};

function formatShortDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTripDateRange(startDate: string, endDate: string): string {
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
}

function formatItemLine(item: PackingItem): string {
  const mark = item.packed ? "x" : " ";
  const notes = item.notes?.trim();
  const suffix = notes ? ` (${notes})` : "";
  return `- [${mark}] ${item.name}${suffix}`;
}

/** Readable text summary for clipboard / Web Share. */
export function formatPackingListText({
  destination,
  startDate,
  endDate,
  items,
}: PackingExportInput): string {
  const lines: string[] = [
    `PackWise — ${destination}`,
    formatTripDateRange(startDate, endDate),
    "",
  ];

  const groups = groupPackingItemsByCategory(items);
  if (groups.length === 0) {
    lines.push("No packing items yet.");
    return lines.join("\n");
  }

  for (const group of groups) {
    lines.push(group.category);
    for (const item of group.items) {
      lines.push(formatItemLine(item));
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export function sanitizeDestinationForFilename(destination: string): string {
  const cleaned = destination
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || "trip";
}

export function packingListPdfFilename(destination: string): string {
  return `packwise-${sanitizeDestinationForFilename(destination)}-packing-list.pdf`;
}

/** Generate and download a simple multi-page PDF via jspdf. */
export async function downloadPackingListPdf(
  input: PackingExportInput
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const marginTop = 48;
  const marginBottom = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = marginTop;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  const title = input.destination;
  const dateRange = formatTripDateRange(input.startDate, input.endDate);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  ensureSpace(22);
  doc.text(title, marginX, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  ensureSpace(18);
  doc.text(dateRange, marginX, y);
  y += 28;

  const groups = groupPackingItemsByCategory(input.items);

  if (groups.length === 0) {
    ensureSpace(16);
    doc.text("No packing items yet.", marginX, y);
  } else {
    for (const group of groups) {
      ensureSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(group.category, marginX, y);
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);

      for (const item of group.items) {
        const mark = item.packed ? "[x]" : "[ ]";
        const notes = item.notes?.trim();
        const line = notes
          ? `${mark} ${item.name} — ${notes}`
          : `${mark} ${item.name}`;
        const wrapped = doc.splitTextToSize(line, maxWidth) as string[];
        const blockHeight = wrapped.length * 14;
        ensureSpace(blockHeight + 4);
        doc.text(wrapped, marginX, y);
        y += blockHeight + 4;
      }

      y += 10;
    }
  }

  doc.save(packingListPdfFilename(input.destination));
}
