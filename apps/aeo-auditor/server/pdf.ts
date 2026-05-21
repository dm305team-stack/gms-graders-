/**
 * HTML to PDF rendering via Playwright (headless Chromium).
 *
 * The report HTML is print-paginated (@page Letter, per-section page breaks),
 * so this just loads it, waits for web fonts, and prints to PDF.
 */

import { chromium } from 'playwright';

export async function renderPdf(html: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    // Wait for the Google-hosted web fonts to finish loading before printing.
    // Passed as a string so it evaluates in the browser, not the Node context.
    await page.evaluate('document.fonts && document.fonts.ready');
    // preferCSSPageSize: true defers to the @page rule from brief-master.html
    // (size: letter; margin: 0) and lets the section's internal padding act as
    // the visual margin. Margins stay at 0 here on purpose — the section
    // padding model is the master spec's design choice.
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await browser.close();
  }
}
