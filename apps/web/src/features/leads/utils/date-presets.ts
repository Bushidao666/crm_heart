export type DatePreset = 'today' | 'week' | 'month' | 'all'

export const getDateRangeForPreset = (preset: DatePreset) => {
  const now = new Date()
  const start = new Date()

  switch (preset) {
    case 'today': {
      start.setHours(0, 0, 0, 0)
      return { start: start.toISOString(), end: now.toISOString() }
    }
    case 'week': {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) // monday as start
      start.setDate(diff)
      start.setHours(0, 0, 0, 0)
      return { start: start.toISOString(), end: now.toISOString() }
    }
    case 'month': {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      return { start: start.toISOString(), end: now.toISOString() }
    }
    case 'all':
    default:
      return { start: null, end: null }
  }
}
