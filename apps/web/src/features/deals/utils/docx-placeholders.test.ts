import { describe, expect, it } from 'vitest'

import { fixFragmentedPlaceholdersInXml, replaceDocxPlaceholders } from './docx-placeholders'

const wrapXml = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><w:document><w:body><w:p>${inner}</w:p></w:body></w:document>`

describe('fixFragmentedPlaceholdersInXml', () => {
  it('merges placeholders split across multiple runs', () => {
    const xml = wrapXml(
      [
        '<w:r><w:t>{{</w:t></w:r>',
        '<w:proofErr w:type="spellStart"/>',
        '<w:r><w:t>deal_full_name</w:t></w:r>',
        '<w:proofErr w:type="spellEnd"/>',
        '<w:r><w:t>}}</w:t></w:r>',
      ].join(''),
    )

    const fixed = fixFragmentedPlaceholdersInXml(xml)

    expect(fixed).toContain('<w:t>{{deal_full_name}}</w:t>')
    expect(fixed).not.toContain('<w:t>{{</w:t>')
    expect(fixed).not.toContain('<w:t>}}</w:t>')
  })

  it('preserves trailing text after reassembling placeholders', () => {
    const xml = wrapXml(
      [
        '<w:r><w:t>{{deal_rg}</w:t></w:r>',
        '<w:r><w:t xml:space="preserve">}, residente</w:t></w:r>',
      ].join(''),
    )

    const fixed = fixFragmentedPlaceholdersInXml(xml)

    expect(fixed).toContain('<w:t>{{deal_rg}}</w:t>')
    expect(fixed).toContain('residente')
    expect(fixed).toMatch(/<w:t(?: xml:space="preserve")?>, residente<\/w:t>/)
  })

  it('keeps already well-formed placeholders intact', () => {
    const xml = wrapXml('<w:r><w:t>{{deal_email}}</w:t></w:r>')
    const fixed = fixFragmentedPlaceholdersInXml(xml)

    expect(fixed).toContain('<w:t>{{deal_email}}</w:t>')
  })

  it('replaces placeholders with provided values', () => {
    const xml = wrapXml('<w:r><w:t>{{deal_full_name}}</w:t></w:r>')
    const replaced = replaceDocxPlaceholders(xml, { deal_full_name: 'Ana & João' })

    expect(replaced).toContain(
      '<w:t>[[__CRM_VAR_OPEN__deal_full_name__]]Ana &amp; João[[__CRM_VAR_CLOSE__deal_full_name__]]</w:t>',
    )
  })

  it('supports dotted placeholders with whitespace', () => {
    const xml = wrapXml('<w:r><w:t>{{ deal.deal_cpf }}</w:t></w:r>')
    const replaced = replaceDocxPlaceholders(xml, { 'deal.deal_cpf': '123' })

    expect(replaced).toContain(
      '<w:t>[[__CRM_VAR_OPEN__deal.deal_cpf__]]123[[__CRM_VAR_CLOSE__deal.deal_cpf__]]</w:t>',
    )
  })
})
