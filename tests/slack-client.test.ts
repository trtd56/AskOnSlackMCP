import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SlackHandler, HumanInSlack } from '../src/slack-client'
import { WebClient } from '@slack/web-api'
import { SocketModeClient } from '@slack/socket-mode'

vi.mock('@slack/web-api')
vi.mock('@slack/socket-mode')

describe('SlackHandler', () => {
  let handler: SlackHandler
  const mockBotToken = 'xoxb-test'
  const mockAppToken = 'xapp-test'

  beforeEach(() => {
    vi.clearAllMocks()
    handler = new SlackHandler(mockBotToken, mockAppToken)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should initialize with correct tokens', () => {
    expect(WebClient).toHaveBeenCalledWith(mockBotToken)
    expect(SocketModeClient).toHaveBeenCalledWith({
      appToken: mockAppToken,
      clientOptions: {
        slackApiUrl: 'https://slack.com/api/',
      },
      logLevel: 'debug'
    })
  })

  it('should start with isReady false', () => {
    expect(handler.isReady).toBe(false)
  })

  it('should handle socket client events', () => {
    const mockOn = vi.fn()
    
    // Mock the SocketModeClient constructor to set up event listeners
    vi.mocked(SocketModeClient).mockImplementation(() => {
      const client = {
        on: mockOn,
        connected: false,
        start: vi.fn(),
        disconnect: vi.fn()
      }
      return client as any
    })

    new SlackHandler(mockBotToken, mockAppToken)

    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function))
    expect(mockOn).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(mockOn).toHaveBeenCalledWith('unable_to_socket_mode_start', expect.any(Function))
  })
})

describe('HumanInSlack', () => {
  let humanInSlack: HumanInSlack
  let mockHandler: any
  const mockChannel = 'C1234567890'
  const mockUser = 'U1234567890'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    
    // Create a proper mock handler with all required properties
    mockHandler = {
      isReady: false,
      webClient: {
        chat: {
          postMessage: vi.fn()
        }
      },
      socketClient: {
        connected: false,
        on: vi.fn()
      }
    }
    
    humanInSlack = new HumanInSlack(mockUser, mockChannel)
    humanInSlack.setHandler(mockHandler)
  })
  
  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should initialize with correct parameters', () => {
    expect(humanInSlack).toBeInstanceOf(HumanInSlack)
    expect(humanInSlack['userId']).toBe(mockUser)
    expect(humanInSlack['channelId']).toBe(mockChannel)
  })

  it('should handle ask timeout', async () => {
    // Mock setTimeout to immediately call the callback
    const originalSetTimeout = global.setTimeout
    let timeoutCallback: Function | null = null
    
    global.setTimeout = vi.fn((callback: Function, ms: number) => {
      if (ms === 60000) {
        timeoutCallback = callback
        return 123 // return a fake timer id
      }
      return originalSetTimeout(callback as any, ms)
    }) as any
    
    // Set up the mock handler for successful message posting
    mockHandler.webClient.chat.postMessage.mockResolvedValue({ ok: true, ts: '1234567890.123456' })
    
    // Set up the handler to be ready and connected
    mockHandler.isReady = true
    mockHandler.socketClient.connected = true

    // Start the ask operation
    const askPromise = humanInSlack.ask('Test question')
    
    // Wait a tick for the promise to be set up
    await new Promise(resolve => setImmediate(resolve))
    
    // Trigger the timeout
    if (timeoutCallback) {
      timeoutCallback()
    }
    
    // Now expect the promise to reject
    await expect(askPromise).rejects.toThrow('Timeout waiting for human response in Slack')
    
    // Restore original setTimeout
    global.setTimeout = originalSetTimeout
  })

  it('should throw error when handler is not ready', async () => {
    mockHandler.isReady = false
    
    await expect(humanInSlack.ask('Test question')).rejects.toThrow('Slack connection is not ready')
  })
})