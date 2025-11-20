const countCharOccurrences = (value: string, target: '{' | '}'): number =>
  value.split(target).length - 1

const extractPlainTextFromRun = (runContent: string): string => {
  const matches = runContent.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g)
  if (!matches) return ''

  return matches
    .map((textTag) => {
      const inner = textTag.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/)
      return inner ? inner[1] : ''
    })
    .join('')
}

const cloneRunWithText = (baseRun: string, text: string): string => {
  if (!text) return ''

  const shouldPreserveSpace = /^\s|\s$/.test(text)
  let clone = baseRun
  let replaced = false

  clone = clone.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/g, (match) => {
    if (replaced) return ''
    replaced = true

    const tagStartMatch = match.match(/<w:t[^>]*>/)
    const closingTag = '</w:t>'
    if (!tagStartMatch) {
      return `<w:t>${text}</w:t>`
    }

    let tagStart = tagStartMatch[0]

    if (shouldPreserveSpace && !/xml:space="preserve"/.test(tagStart)) {
      tagStart = tagStart.replace('<w:t', '<w:t xml:space="preserve"')
    }

    if (!shouldPreserveSpace) {
      tagStart = tagStart.replace(/ xml:space="preserve"/, '')
    }

    return `${tagStart}${text}${closingTag}`
  })

  if (!replaced) {
    const injectionPoint = clone.indexOf('</w:r>')
    const tagStart = shouldPreserveSpace ? '<w:t xml:space="preserve">' : '<w:t>'
    const insertion = `${tagStart}${text}</w:t>`
    if (injectionPoint === -1) {
      return `${clone}${insertion}`
    }
    return `${clone.slice(0, injectionPoint)}${insertion}${clone.slice(injectionPoint)}`
  }

  return clone
}

const PLACEHOLDER_PATTERN = /{{\s*[^{}]+\s*}}/g
const MARKER_OPEN_PREFIX = '[[__CRM_VAR_OPEN__'
const MARKER_CLOSE_PREFIX = '[[__CRM_VAR_CLOSE__'
const MARKER_SUFFIX = '__]]'

const encodeMarkerKey = (key: string) => encodeURIComponent(key)

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const escapeXmlEntities = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const mergeRunsInsideSingleRun = (content: string) =>
  content.replace(/<w:r[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    const textContent = run.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)
    if (!textContent) return run

    const combined = textContent
      .map((t) => {
        const match = t.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/)
        return match ? match[1] : ''
      })
      .join('')

    if (combined.includes('{{') || combined.includes('}}')) {
      const shouldPreserveSpace = /^\s|\s$/.test(combined)
      let updatedRun = run
      let replaced = false

      updatedRun = updatedRun.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/g, (match) => {
        if (replaced) return ''
        replaced = true
        const tagStartMatch = match.match(/<w:t[^>]*>/)
        if (!tagStartMatch) return `<w:t>${combined}</w:t>`
        let tagStart = tagStartMatch[0]
        if (shouldPreserveSpace && !/xml:space="preserve"/.test(tagStart)) {
          tagStart = tagStart.replace('<w:t', '<w:t xml:space="preserve"')
        }
        if (!shouldPreserveSpace) {
          tagStart = tagStart.replace(/ xml:space="preserve"/, '')
        }
        return `${tagStart}${combined}</w:t>`
      })

      if (!replaced) {
        const tagStart = shouldPreserveSpace ? '<w:t xml:space="preserve">' : '<w:t>'
        updatedRun = updatedRun.replace('</w:r>', `${tagStart}${combined}</w:t></w:r>`)
      }

      return updatedRun
    }

    return run
  })

export const fixFragmentedPlaceholdersInXml = (xmlContent: string): string => {
  const merged = mergeRunsInsideSingleRun(xmlContent)

  const runRegex = /<w:r\b[^>]*>[\s\S]*?<\/w:r>/g
  const segments: Array<{ type: 'run' | 'other'; content: string }> = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = runRegex.exec(merged)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'other', content: merged.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'run', content: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < merged.length) {
    segments.push({ type: 'other', content: merged.slice(lastIndex) })
  }

  const resultSegments: string[] = []

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]

    if (segment.type !== 'run') {
      resultSegments.push(segment.content)
      continue
    }

    const baseRunText = extractPlainTextFromRun(segment.content)
    if (!baseRunText.includes('{{')) {
      resultSegments.push(segment.content)
      continue
    }

    let combinedText = baseRunText
    let braceBalance =
      countCharOccurrences(baseRunText, '{') - countCharOccurrences(baseRunText, '}')
    const collectedSegments: string[] = [segment.content]
    let consumed = 1

    while (braceBalance > 0 && index + consumed < segments.length) {
      const nextSegment = segments[index + consumed]
      collectedSegments.push(nextSegment.content)

      if (nextSegment.type === 'run') {
        const text = extractPlainTextFromRun(nextSegment.content)
        combinedText += text
        braceBalance += countCharOccurrences(text, '{') - countCharOccurrences(text, '}')
      }

      consumed += 1
    }

    if (!combinedText.includes('}}') || braceBalance > 0) {
      resultSegments.push(...collectedSegments)
      index += consumed - 1
      continue
    }

    const pieces: string[] = []
    let cursor = 0
    let placeholderMatch: RegExpExecArray | null

    PLACEHOLDER_PATTERN.lastIndex = 0
    while ((placeholderMatch = PLACEHOLDER_PATTERN.exec(combinedText)) !== null) {
      if (placeholderMatch.index > cursor) {
        pieces.push(combinedText.slice(cursor, placeholderMatch.index))
      }
      pieces.push(placeholderMatch[0])
      cursor = placeholderMatch.index + placeholderMatch[0].length
    }

    if (cursor < combinedText.length) {
      pieces.push(combinedText.slice(cursor))
    }

    if (pieces.length === 0) {
      resultSegments.push(...collectedSegments)
      index += consumed - 1
      continue
    }

    for (const piece of pieces) {
      if (!piece) continue
      resultSegments.push(cloneRunWithText(segment.content, piece))
    }

    index += consumed - 1
  }

  return resultSegments.join('')
}

type ReplacementValue = string | number | boolean | null | undefined

export const replaceDocxPlaceholders = (
  xmlContent: string,
  replacements: Record<string, ReplacementValue>,
): string => {
  let result = xmlContent

  for (const [rawKey, rawValue] of Object.entries(replacements)) {
    const key = rawKey.trim()
    if (!key) continue

    const value = rawValue === null || rawValue === undefined ? '' : String(rawValue)
    const escapedValue = escapeXmlEntities(value)
    const keyPattern = new RegExp(`{{\\s*${escapeRegex(key)}\\s*}}`, 'g')
    const encodedKey = encodeMarkerKey(key)
    const openMarker = `${MARKER_OPEN_PREFIX}${encodedKey}${MARKER_SUFFIX}`
    const closeMarker = `${MARKER_CLOSE_PREFIX}${encodedKey}${MARKER_SUFFIX}`
    result = result.replace(keyPattern, `${openMarker}${escapedValue}${closeMarker}`)
  }

  return result
}
