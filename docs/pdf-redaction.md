# PDF redaction

Research into redacting PDFs, done in September 2026. People redact documents as well as photos, so Tuck could open a PDF, redact its pages, and export a new PDF. Not built: it waits until the image editor's redaction is settled, which it now is.

## Covering is not redacting

A PDF stores text as text. A box drawn over it, as an annotation or as a filled rectangle added to the page, leaves the text underneath selectable, copyable, and searchable. Real redaction must either remove the content under the box from the page's content stream, or flatten the page to an image so only pixels remain.

## Approach: flatten each page

```text
PDF
  ↓
Render each page to an image (about 200–300 DPI)
  ↓
Redact each page in the editor as an image document
  ↓
Write a new PDF with one image per page
```

This reuses the editor unchanged: each page is an ordinary `EditorDocument` with the page image as its locked photo, and Redact's layers work on it as they do on a photo. What's new is a level above the document holding its pages, a page strip to move between them, multi-page projects, and PDF export.

It's safe by construction: the new PDF carries none of the original's text, links, form fields, or metadata. The costs are that text is no longer selectable or searchable, and files usually grow.

Default to solid redaction for documents. Blurred or pixelated text can sometimes be recovered, and documents are mostly text.

## Libraries

Rendering pages:

* iOS and Android: `expo-pdf-to-image` or `@dariyd/react-native-pdf-page-image`, which wrap PDFKit and `PdfRenderer`. Both are native modules, which the development build already allows.
* Web: pdf.js.

Writing the PDF: `@cantoo/pdf-lib`, the maintained fork of `pdf-lib`. It's plain JavaScript, runs in React Native, and embeds JPEG and PNG pages. React Native Skia (2.6.2 when researched) exposes no PDF API, even though Skia itself can write PDFs.

## Rejected for now

* Commercial SDKs (Nutrient, formerly PSPDFKit; ComPDF; Apryse) do true content-removing redaction with their own UI, but they are paid, heavy, and conflict with keeping dependencies narrow.
* MuPDF can remove content too, but it's AGPL-licensed.
* EmbedPDF (MIT license) does true redaction with PDFium compiled to WebAssembly, but only in the browser. Hermes is reported to be gaining WebAssembly support; whether it's ready for production apps wasn't confirmed. Its redaction also shows how hard content removal is: before v2.15.1, redacting several regions of one line of text left fragments of the redacted words in the saved file.

Revisit content-removing redaction only if users need redacted PDFs to keep selectable text.
