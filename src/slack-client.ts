/**
 * Slack client implementation for human interaction.
 */

import { WebClient } from '@slack/web-api';
import { SocketModeClient } from '@slack/socket-mode';
import { Human } from './human.js';
import { PendingResponse, MessageLogEntry, SlackMessageEvent } from './types.js';

const logger = {
  info: (message: string) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
  error: (message: string) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`),
  warn: (message: string) => console.warn(`[WARN] ${new Date().toISOString()} - ${message}`),
};

export class SlackHandler {
  public webClient: WebClient;
  public socketClient: SocketModeClient;
  public isReady: boolean = false;
  private startPromise: Promise<void> | null = null;

  constructor(botToken: string, appToken: string) {
    logger.info(`Initializing SlackHandler with tokens: bot=${botToken.slice(0, 10)}..., app=${appToken.slice(0, 10)}...`);
    
    this.webClient = new WebClient(botToken);
    this.socketClient = new SocketModeClient({
      appToken,
      // より寛容な設定を追加
      clientOptions: {
        slackApiUrl: 'https://slack.com/api/',
      },
      // ログレベルを調整
      logLevel: 'debug' as any, // Changed to debug for more info
    });
    
    // エラーハンドリングを追加
    this.socketClient.on('error', (error) => {
      logger.error(`Socket Mode error: ${error.message}`);
    });
    
    this.socketClient.on('disconnect', () => {
      logger.warn('Socket Mode disconnected');
      this.isReady = false;
    });
    
    // Handle reconnection
    this.socketClient.on('reconnecting', () => {
      logger.info('Socket Mode reconnecting...');
      this.isReady = false;
    });
    
    // 接続拒否時のハンドリング
    this.socketClient.on('unable_to_socket_mode_start', (error) => {
      logger.error(`Unable to start Socket Mode: ${error.message}`);
    });
    
    // 接続成功時のハンドリング
    this.socketClient.on('connected', () => {
      logger.info('Socket Mode connected event received');
      this.isReady = true;
    });
    
    this.socketClient.on('authenticated', () => {
      logger.info('Socket Mode authenticated event received');
    });
    
    // Debug: Log all events
    this.socketClient.on('connecting', () => {
      logger.info('Socket Mode connecting event received');
    });
    
    this.socketClient.on('ready', () => {
      logger.info('Socket Mode ready event received');
    });
    
    this.socketClient.on('disconnecting', () => {
      logger.info('Socket Mode disconnecting event received');
    });
    
    // Listen for hello event
    this.socketClient.on('hello', () => {
      logger.info('Socket Mode hello event received');
    });
  }

  async start(): Promise<void> {
    // If already starting, return the existing promise
    if (this.startPromise) {
      logger.info('Start already in progress, returning existing promise');
      return this.startPromise;
    }

    this.startPromise = this._doStart();
    return this.startPromise;
  }

  private async _doStart(): Promise<void> {
    logger.info('Starting Slack client...');

    // Test connection
    try {
      logger.info('Testing WebClient authentication...');
      const authResponse = await this.webClient.auth.test();
      if (authResponse.ok) {
        logger.info(`Slack bot ready as ${authResponse.user}`);
        logger.info(`Team: ${authResponse.team}`);
      } else {
        throw new Error(`Auth test failed: ${authResponse.error}`);
      }
    } catch (error) {
      logger.error(`Failed to authenticate with Slack: ${error}`);
      if (error instanceof Error && error.message.includes('invalid_auth')) {
        throw new Error('Invalid bot token. Please check your SLACK_BOT_TOKEN.');
      }
      throw error;
    }

    // Start socket mode client
    try {
      logger.info('Starting Socket Mode client...');
      
      // Check if already connected
      if (this.socketClient.connected) {
        logger.info('Socket client already connected');
        this.isReady = true;
        return;
      }
      
      // Create a promise to wait for the connected event
      const connectedPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Socket Mode connection timeout after 30 seconds'));
        }, 30000); // Increased timeout to 30 seconds
        
        // Set up one-time listener for connected event
        const connectedHandler = () => {
          logger.info('Socket Mode connected event fired');
          clearTimeout(timeout);
          resolve();
        };
        
        // Also listen for error events
        const errorHandler = (error: Error) => {
          logger.error(`Socket Mode error during connection: ${error.message}`);
          clearTimeout(timeout);
          this.socketClient.off('connected', connectedHandler);
          reject(error);
        };
        
        this.socketClient.once('connected', connectedHandler);
        this.socketClient.once('error', errorHandler);
      });
      
      // Start the socket client
      logger.info('Calling socketClient.start()...');
      const startPromise = this.socketClient.start();
      
      // Wait for both the start promise and the connected event
      await Promise.all([startPromise, connectedPromise]);
      
      logger.info('Socket Mode client successfully connected');
      this.isReady = true;
      
    } catch (error) {
      logger.error(`Failed to start Socket Mode: ${error}`);
      if (error instanceof Error) {
        if (error.message.includes('invalid_auth')) {
          throw new Error('Invalid app token. Please check your SLACK_APP_TOKEN.');
        }
        if (error.message.includes('not_allowed_token_type')) {
          throw new Error('App token must be an app-level token (xapp-). Please check your SLACK_APP_TOKEN.');
        }
        if (error.message.includes('server explicit disconnect')) {
          throw new Error('Socket Mode connection rejected. Please verify: 1) Socket Mode is enabled in your Slack app, 2) App token has connections:write scope, 3) Event subscriptions are configured.');
        }
        if (error.message.includes('Socket Mode connection timeout')) {
          // Add more debugging info
          logger.error('Socket Mode connection timeout - possible causes:');
          logger.error('1. Socket Mode may not be enabled in your Slack app');
          logger.error('2. The app token may not have the correct scopes');
          logger.error('3. There may be network issues preventing WebSocket connection');
          logger.error('4. The Slack app may not be properly installed in the workspace');
        }
      }
      throw error;
    }
  }


  async stop(): Promise<void> {
    if (this.socketClient) {
      await this.socketClient.disconnect();
    }
    logger.info('Slack client stopped');
  }
}

export class HumanInSlack extends Human {
  public handler?: SlackHandler;
  private pendingResponses: Map<string, PendingResponse> = new Map();
  private responseResolvers: Map<string, (response: string) => void> = new Map();
  private messageLog: MessageLogEntry[] = [];
  private eventCount: number = 0;

  constructor(
    private userId: string,
    private channelId: string
  ) {
    super();
  }

  setHandler(handler: SlackHandler): void {
    this.handler = handler;
    
    // Set up message handler
    this.handler.socketClient.on('message', async ({ event, ack }) => {
      const ackStart = Date.now();
      await ack();
      const ackDuration = Date.now() - ackStart;
      if (ackDuration > 10) {
        logger.warn(`Slow ack: ${ackDuration}ms`);
      }
      await this.handleSocketModeRequest(event);
    });
    
    logger.info('Added socket mode message listener');
  }

  private async handleSocketModeRequest(event: SlackMessageEvent): Promise<void> {
    const eventReceivedTime = Date.now();
    logger.info(`[TIMING] Event received: type=${event.type}, timestamp=${eventReceivedTime}`);
    
    // Track all events for debugging
    this.eventCount++;

    // Log all message events for debugging
    if (event.type === 'message') {
      const messageInfo: MessageLogEntry = {
        timestamp: Date.now() / 1000,
        channel: event.channel,
        user: event.user,
        text: (event.text || '').slice(0, 50),
        threadTs: event.thread_ts,
        botId: event.bot_id,
      };
      this.messageLog.push(messageInfo);
      
      // Keep only last 50 messages
      if (this.messageLog.length > 50) {
        this.messageLog.shift();
      }
    }

    if (event.type === 'message' && !event.bot_id) {
      // Check if this is a response we're waiting for
      const channelId = event.channel;
      const userId = event.user;
      const text = event.text || '';
      const threadTs = event.thread_ts;

      const messageReceivedTime = Date.now();
      logger.info(`[TIMING] Message received: timestamp=${messageReceivedTime}, channel=${channelId}, user=${userId}, thread=${threadTs}, text=${text.slice(0, 50)}...`);

      // Check if this message is a response to one of our questions
      logger.info(`Checking against ${this.pendingResponses.size} pending questions...`);
      
      for (const [questionId, questionData] of this.pendingResponses.entries()) {
        logger.info(`Question ${questionId}: channel=${questionData.channel}, user=${questionData.user}, threadTs=${questionData.threadTs}`);

        // Check if this is a response in the same channel and from the expected user
        if (channelId === questionData.channel && userId === questionData.user) {
          // For thread replies, the thread_ts in the response should match our original message ts
          if (threadTs === questionData.threadTs) {
            const responseFoundTime = Date.now();
            logger.info(`[TIMING] ✅ Response matched: questionId=${questionId}, timestamp=${responseFoundTime}`);
            questionData.response = text;
            questionData.received = true;
            
            // Immediately resolve the promise if there's a resolver waiting
            const resolver = this.responseResolvers.get(questionId);
            if (resolver) {
              logger.info(`[TIMING] Resolving promise immediately`);
              resolver(text);
              this.responseResolvers.delete(questionId);
            }
            
            break;
          } else {
            logger.info(`Thread mismatch: got ${threadTs}, expected ${questionData.threadTs}`);
          }
        }
      }
    }
  }

  async ask(question: string): Promise<string> {
    if (!this.handler) {
      logger.error('No handler set for HumanInSlack');
      throw new Error('No Slack handler configured');
    }
    
    // Check both isReady flag and actual connection status
    if (!this.handler.isReady || !this.handler.socketClient.connected) {
      logger.error(`Slack connection check failed - isReady: ${this.handler.isReady}, connected: ${this.handler.socketClient.connected}`);
      throw new Error('Slack connection is not ready');
    }

    // Generate unique question ID
    const questionId = `q_${Date.now()}`;

    try {
      // Send the question with user mention
      const messageText = `<@${this.userId}> ${question}`;

      // Post message to channel
      const sendStartTime = Date.now();
      logger.info(`[TIMING] Sending message: timestamp=${sendStartTime}`);
      const result = await this.handler.webClient.chat.postMessage({
        channel: this.channelId,
        text: messageText,
      });
      const sendDuration = Date.now() - sendStartTime;
      logger.info(`[TIMING] Message sent: duration=${sendDuration}ms, ts=${result.ts}`);

      if (!result.ok) {
        throw new Error(`Failed to send message: ${result.error}`);
      }

      const threadTs = result.ts!;
      logger.info(`Sent question to Slack channel ${this.channelId}, thread ${threadTs}: ${question.slice(0, 50)}...`);

      // Set up response tracking
      const pendingResponse: PendingResponse = {
        channel: this.channelId,
        user: this.userId,
        threadTs,
        response: null,
        received: false,
      };
      this.pendingResponses.set(questionId, pendingResponse);

      // Wait for response with timeout using Promise-based approach
      const timeout = 60000; // 60 seconds
      const startTime = Date.now();

      try {
        const responsePromise = new Promise<string>((resolve, reject) => {
          // Store the resolver for immediate resolution when message arrives
          this.responseResolvers.set(questionId, resolve);
          
          // Set timeout
          setTimeout(() => {
            if (this.responseResolvers.has(questionId)) {
              this.responseResolvers.delete(questionId);
              reject(new Error('Timeout waiting for human response in Slack'));
            }
          }, timeout);
        });

        const response = await responsePromise;
        const responseTime = Date.now() - startTime;
        logger.info(`[TIMING] Total response time: ${responseTime}ms`);
        logger.info(`[TIMING] Response content: ${response.slice(0, 50)}...`);
        
        // Clean up
        this.pendingResponses.delete(questionId);
        return response;
        
      } catch (error) {
        // Clean up on error
        this.pendingResponses.delete(questionId);
        this.responseResolvers.delete(questionId);
        logger.error(`Timeout waiting for response from user ${this.userId}`);
        throw error;
      }

    } catch (error) {
      // Clean up on error
      this.pendingResponses.delete(questionId);
      throw error;
    }
  }

  getMessageLog(): MessageLogEntry[] {
    return [...this.messageLog];
  }

  getEventCount(): number {
    return this.eventCount;
  }
}