import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import mammoth from 'mammoth'

// Configura o worker do PDF.js para processamento otimizado
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
}

/**
 * Extrai texto e metadados de arquivos nos formatos: PDF, DOCX, Markdown, TXT, OWL, TTL
 */
export async function extractTextFromFile(file) {
  const extension = file.name.split('.').pop().toLowerCase()

  switch (extension) {
    case 'pdf':
      return await extractFromPdf(file)
    case 'docx':
      return await extractFromDocx(file)
    case 'md':
    case 'markdown':
      return await extractFromMarkdown(file)
    case 'owl':
    case 'ttl':
    case 'rdf':
    case 'n3':
      return await extractFromOntology(file)
    case 'txt':
    case 'json':
    default:
      return await extractFromPlainText(file)
  }
}

/**
 * Extração de PDF página a página com marcadores estruturais
 */
async function extractFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  const pages = []
  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageString = textContent.items
      .map(item => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    pages.push({
      pageNumber: i,
      text: pageString
    })

    fullText += `\n\n--- [Página ${i}] ---\n\n` + pageString
  }

  return {
    rawText: fullText.trim(),
    pages,
    type: 'pdf',
    pageCount: pdf.numPages
  }
}

/**
 * Extração de DOCX usando Mammoth
 */
async function extractFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return {
    rawText: result.value.trim(),
    type: 'docx',
    messages: result.messages
  }
}

/**
 * Extração de Markdown
 */
async function extractFromMarkdown(file) {
  const rawText = await file.text()
  return {
    rawText: rawText.trim(),
    type: 'markdown'
  }
}

/**
 * Extração de Ontologias OWL / Turtle / RDF
 */
async function extractFromOntology(file) {
  const rawText = await file.text()
  return {
    rawText: rawText.trim(),
    type: 'ontology'
  }
}

/**
 * Extração de Arquivos de Texto Simples
 */
async function extractFromPlainText(file) {
  const rawText = await file.text()
  return {
    rawText: rawText.trim(),
    type: 'text'
  }
}
