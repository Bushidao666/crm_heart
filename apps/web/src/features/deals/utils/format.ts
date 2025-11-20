export const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export const formatCEP = (value: string) => {
  return value
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, (_match, ddd, first, last) =>
      [ddd, first, last].filter(Boolean).join('-'),
    )
  }

  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, (_match, ddd, first, last) =>
    [ddd, first, last].filter(Boolean).join('-'),
  )
}

export const formatRG = (value: string) => {
  return value.replace(/\D/g, '').slice(0, 12)
}

export const parseCurrency = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return value
  if (!value) return 0
  const normalized = value.replace(/[^0-9,.-]/g, '').replace('.', '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isNaN(parsed) ? 0 : parsed
}

export const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
