/**
 * PDF generálás — HTML → PDF
 *
 * POST /api/v1/generate-pdf
 * Body: { html: string, filename: string }
 *
 * - Chromium headless-szel generálja a PDF-et
 * - Ha PDF_OUTPUT_DIR env van beállítva, oda is menti
 * - Mindig visszaküldi a PDF binarit letöltéshez
 */
import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer-core'
import { tryAuth } from '../lib/authGuards.js'

const CHROMIUM_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  '/usr/bin/chromium-browser'

const PDF_OUTPUT_DIR = process.env.PDF_OUTPUT_DIR || ''

async function generatePdfBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })
    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    })
    return Buffer.from(pdfUint8Array)
  } finally {
    await browser.close()
  }
}

export async function pdfRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: { html: string; filename: string }
  }>('/generate-pdf', {
    schema: {
      body: {
        type: 'object',
        required: ['html', 'filename'],
        properties: {
          html:      { type: 'string' },
          filename:  { type: 'string' },
        },
      },
    },
    preHandler: [tryAuth],
  }, async (request, reply) => {
    const { html, filename } = request.body

    // Biztonságos fájlnév (path traversal ellen)
    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_\-. ]/g, '_')
    const pdfName = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generatePdfBuffer(html)
    } catch (err) {
      app.log.error({ err }, 'PDF generálás sikertelen')
      return reply.code(500).send({ error: 'PDF generálás sikertelen', detail: String(err) })
    }

    // Mentés konfigurált mappába (ha be van állítva)
    if (PDF_OUTPUT_DIR) {
      try {
        fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true })
        fs.writeFileSync(path.join(PDF_OUTPUT_DIR, pdfName), pdfBuffer)
        app.log.info(`PDF mentve: ${path.join(PDF_OUTPUT_DIR, pdfName)}`)
      } catch (err) {
        app.log.warn({ err }, `PDF mentés sikertelen: ${PDF_OUTPUT_DIR}`)
        // Nem fatális — a letöltés még folytatódik
      }
    }

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${pdfName}"`)
      .send(pdfBuffer)
  })
}
