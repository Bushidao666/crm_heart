type BuildDealFilePathParams = {
  dealId: string
  dealName: string
  dealCpf: string
  label: string
  extension?: string
}

const removeDiacritics = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export const sanitizeValueForFilename = (value: string, fallback: string) => {
  const normalized = removeDiacritics(value ?? '').trim() || fallback
  return normalized.replace(/[\\/:"*?<>|]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

export const buildDealFolderName = (dealId: string, dealName: string) => {
  const ascii = removeDiacritics(dealName ?? '').toLowerCase()
  const slug = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-')
  return slug || `deal-${dealId}`
}

const normalizeExtension = (extension?: string) => {
  if (!extension) return ''
  const trimmed = extension.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

export const buildDealFilePath = ({ dealId, dealName, dealCpf, label, extension }: BuildDealFilePathParams) => {
  const folderName = buildDealFolderName(dealId, dealName)
  const safeLabel = sanitizeValueForFilename(label, 'Documento')
  const safeName = sanitizeValueForFilename(dealName, `Negocio ${dealId}`)
  const safeCpf = sanitizeValueForFilename(dealCpf, 'CPF nao informado')
  const normalizedExtension = normalizeExtension(extension)
  const fileName = `${safeLabel} - ${safeName} ${safeCpf}${normalizedExtension}`.trim()
  return `${folderName}/${fileName}`
}

export const extractFileExtension = (fileName: string) => {
  const trimmed = fileName?.trim() ?? ''
  if (!trimmed) return ''
  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot === -1 || lastDot === trimmed.length - 1) {
    return ''
  }

  return trimmed.slice(lastDot)
}
