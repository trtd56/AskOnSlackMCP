import { describe, it, expect } from 'vitest'
import type { Config, PendingResponse, MessageLogEntry, SlackMessageEvent } from '../src/types'

describe('Type Definitions', () => {
  describe('Config', () => {
    it('should accept valid config', () => {
      const config: Config = {
        slackBotToken: 'xoxb-test',
        slackAppToken: 'xapp-test',
        slackChannelId: 'C1234567890',
        slackUserId: 'U1234567890',
        logLevel: 'info'
      }
      expect(config).toBeDefined()
      expect(config.slackBotToken).toBe('xoxb-test')
    })

    it('should accept config without optional logLevel', () => {
      const config: Config = {
        slackBotToken: 'xoxb-test',
        slackAppToken: 'xapp-test',
        slackChannelId: 'C1234567890',
        slackUserId: 'U1234567890'
      }
      expect(config.logLevel).toBeUndefined()
    })
  })

  describe('PendingResponse', () => {
    it('should create valid pending response', () => {
      const pendingResponse: PendingResponse = {
        channel: 'C1234567890',
        user: 'U1234567890',
        threadTs: '1234567890.123456',
        response: null,
        received: false
      }
      expect(pendingResponse).toBeDefined()
      expect(pendingResponse.received).toBe(false)
    })
  })

  describe('MessageLogEntry', () => {
    it('should create valid message log entry', () => {
      const entry: MessageLogEntry = {
        timestamp: Date.now(),
        channel: 'C1234567890',
        user: 'U1234567890',
        text: 'Test message',
        threadTs: '1234567890.123456',
        botId: 'B1234567890'
      }
      expect(entry).toBeDefined()
      expect(entry.text).toBe('Test message')
    })
  })

  describe('SlackMessageEvent', () => {
    it('should create valid slack message event', () => {
      const event: SlackMessageEvent = {
        type: 'message',
        channel: 'C1234567890',
        user: 'U1234567890',
        text: 'Test message',
        ts: '1234567890.123456',
        thread_ts: '1234567890.123456',
        bot_id: 'B1234567890',
        subtype: 'bot_message'
      }
      expect(event).toBeDefined()
      expect(event.type).toBe('message')
    })
  })
})