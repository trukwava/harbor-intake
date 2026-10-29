/** Production integration seam. Imported bytes and model outputs are untrusted. */
export interface ReadablePage {
  pdfIndex: number;
  printedLabel: string;
  text: string;
}
export interface OCRAdapter {
  readonly name: string;
  read(
    bytes: Uint8Array,
  ): Promise<{ pages: ReadablePage[]; warnings: string[] }>;
}
export interface ExtractionAdapter {
  readonly name: string;
  propose(
    pages: ReadablePage[],
    fieldNames: readonly string[],
  ): Promise<unknown>;
}
export class UnconfiguredOCR implements OCRAdapter {
  name = "Not connected";
  async read(_bytes: Uint8Array) {
    return {
      pages: [],
      warnings: ["OCR is not configured. No readable pages were fabricated."],
    };
  }
}
export class UnconfiguredModel implements ExtractionAdapter {
  name = "Not connected";
  async propose(
    _pages: ReadablePage[],
    _fields: readonly string[],
  ): Promise<unknown> {
    throw Error(
      "Model extraction is not configured. Use deterministic fixtures or manual review.",
    );
  }
}
/** Strict reference validation required before any connected adapter output reaches persistence. */
export function validateModelOutput(
  output: unknown,
  pages: ReadablePage[],
  allowed: string[],
) {
  if (!Array.isArray(output) || output.length > allowed.length)
    throw Error("Expected bounded array of field candidates");
  const seen = new Set<string>();
  return output.map((item: any) => {
    if (
      !item ||
      !allowed.includes(item.field) ||
      seen.has(item.field) ||
      typeof item.value !== "string" ||
      typeof item.excerpt !== "string" ||
      !item.excerpt ||
      item.value.length > 10000 ||
      !Number.isInteger(item.pdfIndex)
    )
      throw Error("Invalid candidate schema");
    seen.add(item.field);
    const page = pages.find((p) => p.pdfIndex === item.pdfIndex);
    if (
      !page ||
      !page.text.includes(item.excerpt) ||
      !item.excerpt.includes(item.value)
    )
      throw Error("Unsupported source reference");
    return {
      field: item.field,
      value: item.value,
      pdfIndex: item.pdfIndex,
      excerpt: item.excerpt,
    };
  });
}
