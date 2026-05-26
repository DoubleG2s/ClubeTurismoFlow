import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PdfExtractorService {
  private pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

  async getPdfJs() {
    if (typeof window === "undefined") {
      throw new Error("PDF extraction only works in the browser");
    }
    if (!this.pdfjsPromise) {
      this.pdfjsPromise = (async () => {
        const pdfjs = await import('pdfjs-dist');
        // Usar CDN garante que não teremos conflitos de worker paths com Angular build system
        const workerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        return pdfjs;
      })();
    }
    return this.pdfjsPromise;
  }

  async extractText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = await this.getPdfJs();
    
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let parts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str).join(" ");
      parts.push(`--- Página ${i} ---\n${text}`);
    }

    const fullText = parts.join('\n');
    if (!fullText || fullText.trim() === '') {
      throw new Error('PDF vazio ou escaneado. Nenhuma camada de texto encontrada.');
    }
    return fullText;
  }
}
