/**
 * Extract plain text from a file buffer based on its mimetype.
 * Returns { text, pageCount, format }.
 * Throws on unsupported format or parse failure.
 */
async function extractText(buffer, mimetype, filename) {
  if (mimetype === 'application/pdf') {
    return extractPDF(buffer, filename);
  }

  // DOCX support — secondary priority, added in later checkpoint
  // PPTX — only if full MVP is done with time remaining

  throw new Error(`Unsupported file format: ${mimetype}. Currently supported: PDF`);
}

async function extractPDF(buffer, filename) {
  // Dynamic import for pdfjs-dist (ESM module)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const uint8Array = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useSystemFonts: true,
  });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    throw new Error(`Failed to parse PDF "${filename}": ${err.message}`);
  }

  const pageCount = doc.numPages;
  const textParts = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    textParts.push(pageText);
  }

  const text = textParts.join('\n\n').trim();

  if (!text || text.length < 10) {
    throw new Error(
      `Could not extract meaningful text from "${filename}". The PDF may be image-based or empty.`
    );
  }

  return {
    text,
    pageCount,
    format: 'pdf',
  };
}

module.exports = { extractText };
