import { describe, expect, it } from 'vitest'
import { exportTitle, sanitizeExportFilename } from './export-long-image'

describe('long image export helpers', () => {
  it('keeps the first legacy detail heading as the filename', () => {
    const element = document.createElement('section')
    element.innerHTML = '<h1>  莱万汀 / 档案  </h1><h2>技能</h2>'

    expect(exportTitle(element, '角色')).toBe('莱万汀 _ 档案')
  })

  it('sanitizes Windows filename characters and keeps a stable fallback', () => {
    expect(sanitizeExportFilename(' a<b>:c/d\\e|f?g*" ')).toBe('a_b__c_d_e_f_g__')
    expect(sanitizeExportFilename('   ', 'AKEData')).toBe('AKEData')
  })
})
