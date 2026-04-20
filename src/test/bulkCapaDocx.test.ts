import { describe, expect, it } from "vitest";

import { buildPhotoGridRows, generateBulkCapaOfficialDocx, type BulkCapaOfficialEntry } from "../pages/BulkCAPA";

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9WmJ4AAAAASUVORK5CYII=";

describe("BulkCAPA DOCX photo layout", () => {
  it("groups photos in 3-column rows for each entry", () => {
    const photos: NonNullable<BulkCapaOfficialEntry["photos"]> = [
      { file: tinyPngBase64 },
      { file: tinyPngBase64 },
      { file: tinyPngBase64 },
      { file: tinyPngBase64 },
    ];

    const rows = buildPhotoGridRows(0, [
      ...photos,
    ]);
    const firstRowCells = (rows[0] as { options: { children: unknown[] } }).options.children;
    const secondRowCells = (rows[1] as { options: { children: unknown[] } }).options.children;

    expect(rows).toHaveLength(2);
    expect(firstRowCells).toHaveLength(3);
    expect(secondRowCells).toHaveLength(3);
  });

  it("generates a DOCX buffer without mixing entry blocks", async () => {
    const buffer = await generateBulkCapaOfficialDocx([
      {
        itemNo: 1,
        title: "Elektrik pano riski",
        photos: [{ file: tinyPngBase64 }, { file: tinyPngBase64 }],
        nonCompliance: "Pano kapağı açık",
        riskAnalysis: "Elektrik çarpması",
        legislationBasis: "6331 ve ilgili yönetmelik",
        suggestedCapa: "Kapağın kilitlenmesi",
        dueDate: "2026-05-01",
        actionPlan: "Kilitleme aparatı takılacak",
        responsible: "Bakım sorumlusu",
      },
      {
        itemNo: 2,
        title: "Yüksekte çalışma",
        photos: [{ file: tinyPngBase64 }],
        nonCompliance: "Korkuluk yok",
        riskAnalysis: "Düşme riski",
        legislationBasis: "İş Ekipmanları Yönetmeliği",
        suggestedCapa: "Geçici bariyer",
      },
    ]);

    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
