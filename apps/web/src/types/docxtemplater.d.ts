declare module 'docxtemplater' {
  import PizZip from 'pizzip'

  type DocData = Record<string, unknown>

  export interface DocxtemplaterOptions {
    paragraphLoop?: boolean
    linebreaks?: boolean
    nullGetter?: () => string
  }

  export default class Docxtemplater {
    constructor(zip: PizZip, options?: DocxtemplaterOptions)
    render(data: DocData): void
    getZip(): {
      generate(options: { type: 'arraybuffer' }): ArrayBuffer
    }
  }
}
