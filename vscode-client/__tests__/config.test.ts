const packageJson = require('../package.json')
import { getDefaultConfiguration } from '../../server/src/config'

const defaultConfig = getDefaultConfiguration()

describe('config', () => {
  const configProperties = packageJson.contributes.configuration.properties

  it('prefixes all keys with "bashIde."', () => {
    for (const key of Object.keys(configProperties)) {
      expect(key).toMatch(/^bashIde\./)
    }
  })

  it('has the same keys as the default configuration', () => {
    const configKeys = Object.keys(configProperties)
      .map((key) => key.replace(/^bashIde\./, ''))
      .sort()
    const defaultConfigKeys = Object.keys(defaultConfig).sort()
    expect(configKeys).toEqual(defaultConfigKeys)
  })
})
