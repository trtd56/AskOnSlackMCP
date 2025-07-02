import { describe, it, expect, vi } from 'vitest'
import { parseArgs } from '../src/index'

describe('CLI Argument Parsing', () => {
  it('should parse all required arguments', () => {
    const args = [
      'node',
      'script.js',
      '--slack-bot-token', 'xoxb-test',
      '--slack-app-token', 'xapp-test',
      '--slack-channel-id', 'C1234567890',
      '--slack-user-id', 'U1234567890'
    ]
    
    const config = parseArgs(args)
    
    expect(config).toEqual({
      slackBotToken: 'xoxb-test',
      slackAppToken: 'xapp-test',
      slackChannelId: 'C1234567890',
      slackUserId: 'U1234567890',
      logLevel: 'INFO'
    })
  })

  it('should parse optional log level', () => {
    const args = [
      'node',
      'script.js',
      '--slack-bot-token', 'xoxb-test',
      '--slack-app-token', 'xapp-test',
      '--slack-channel-id', 'C1234567890',
      '--slack-user-id', 'U1234567890',
      '--log-level', 'DEBUG'
    ]
    
    const config = parseArgs(args)
    
    expect(config.logLevel).toBe('DEBUG')
  })

  it('should throw error when required arguments are missing', () => {
    const args = ['node', 'script.js', '--slack-bot-token', 'xoxb-test']
    
    expect(() => parseArgs(args)).toThrow()
  })
})