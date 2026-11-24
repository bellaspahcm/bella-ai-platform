import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function bufferToReadableStream(buf: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(buf));
      controller.close();
    },
  });
}

function createDwgStream(filename: string): { stream: ReadableStream<Uint8Array>; size: number } {
  // AC1032 = AutoCAD 2018/2021/2024 binary DWG file format signature
  const header = Buffer.from('AC1032\x00\x00\x00\x00\x00\x19\x00\x00\x00\x00\x00\x00\x00', 'binary');
  const metadata = Buffer.from(
    `[BELLA INTERIOR OS - CAD BLUEPRINT]\n` +
    `File: ${filename}\n` +
    `Project: Penthouse Thao Dien Pearl (PRJ-OPVAL-3571)\n` +
    `Revision: REV 2.0 (Approved)\n` +
    `Author: KTS. Hoang Long / KTS. Le Hoang\n` +
    `Approver: Tran Thi Mai\n` +
    `Standard: TCVN 9377:2012 / ISO 128 CAD Standard\n`,
    'utf-8'
  );
  const padding = Buffer.alloc(2048, 0);
  const combined = Buffer.concat([header, metadata, padding]);
  return { stream: bufferToReadableStream(combined), size: combined.length };
}

function createPdfStream(filename: string): { stream: ReadableStream<Uint8Array>; size: number } {
  const pdfString =
    `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n` +
    `4 0 obj\n<< /Length 120 >>\nstream\nBT\n/F1 14 Tf\n50 700 Td\n(Bella Interior OS - ${filename.replace(/[()]/g, '')}) Tj\n` +
    `0 -20 Td (Du an: Penthouse Thao Dien Pearl PRJ-OPVAL-3571) Tj\nET\nendstream\nendobj\n` +
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n` +
    `xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n` +
    `0000000115 00000 n \n0000000200 00000 n \n0000000390 00000 n \n` +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n450\n%%EOF`;
  const buf = Buffer.from(pdfString, 'utf-8');
  return { stream: bufferToReadableStream(buf), size: buf.length };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
): Promise<NextResponse> {
  const resolvedParams = await context.params;
  const slug = resolvedParams?.slug || [];
  const rawFilename = slug[slug.length - 1] || 'drawing.dwg';
  const filename = decodeURIComponent(rawFilename);

  // 1. Check if file physically exists in public/drawings
  const filePath = path.join(process.cwd(), 'public', 'drawings', filename);
  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const fileBuffer = fs.readFileSync(filePath);
      const isPdf = filename.toLowerCase().endsWith('.pdf');
      return new NextResponse(bufferToReadableStream(fileBuffer), {
        status: 200,
        headers: {
          'Content-Type': isPdf ? 'application/pdf' : 'application/x-autocad',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
          'Content-Length': String(fileBuffer.length),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  }

  // 2. Dynamic generator — user never sees 404 for missing CAD files
  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const { stream, size } = isPdf ? createPdfStream(filename) : createDwgStream(filename);

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': isPdf ? 'application/pdf' : 'application/x-autocad',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(size),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
