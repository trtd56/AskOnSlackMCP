#!/usr/bin/env node

/**
 * Main entry point for the Human-in-the-Loop Slack MCP Server.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { program } from 'commander';
import { HumanInSlack, SlackHandler } from './slack-client.js';
import { SimpleHumanInSlack, SimpleSlackHandler } from './simple-slack-client.js';
import { Config } from './types.js';

const logger = {
  info: (message: string) => console.error(`[INFO] ${new Date().toISOString()} - ${message}`),
  error: (message: string) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`),
  warn: (message: string) => console.error(`[WARN] ${new Date().toISOString()} - ${message}`),
};

function setupLogging(logLevel: string = 'INFO'): void {
  // In a real implementation, you'd configure logging levels here
  logger.info(`Log level set to: ${logLevel}`);
}

function parseArgs(): Config {
  program
    .name('human-in-the-loop-slack')
    .description('Human-in-the-Loop Slack MCP Server - Enables AI assistants to request information from humans via Slack')
    .version('0.1.0')
    .requiredOption('--slack-bot-token <token>', 'Slack bot token (xoxb-...)')
    .requiredOption('--slack-app-token <token>', 'Slack app token for Socket Mode (xapp-...)')
    .requiredOption('--slack-channel-id <id>', 'Slack channel ID (C...)')
    .requiredOption('--slack-user-id <id>', 'Slack user ID (U...)')
    .option('--log-level <level>', 'Log level (DEBUG, INFO, WARN, ERROR)', 'INFO')
    .parse();

  const options = program.opts();

  return {
    slackBotToken: options.slackBotToken,
    slackAppToken: options.slackAppToken,
    slackChannelId: options.slackChannelId,
    slackUserId: options.slackUserId,
    logLevel: options.logLevel,
  };
}

async function main() {
  const config = parseArgs();
  setupLogging(config.logLevel);

  // Node.js v24 では Socket Mode に問題があるため、シンプルモードを使用
  const isNodeV24 = process.version.startsWith('v24.');
  if (isNodeV24) {
    logger.info('Detected Node.js v24 - using Simple Web API mode instead of Socket Mode');
  }

  // Create appropriate human handler based on Node.js version
  const human = isNodeV24 
    ? new SimpleHumanInSlack(config.slackUserId, config.slackChannelId)
    : new HumanInSlack(config.slackUserId, config.slackChannelId);

  // Create MCP server
  const server = new Server(
    {
      name: 'Human in the loop - Slack',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
  // Store config in closure for tool handlers
  const currentConfig = config;

  // Tool: check_environment
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'ping',
        description: 'Simple ping test to verify MCP server is responding',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'check_environment',
        description: 'Check the current environment variables for debugging.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'test_slack_connection',
        description: 'Test if Slack is receiving messages by sending a test message.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'check_message_log',
        description: 'Check the message reception log to see what messages have been received.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'check_socket_status',
        description: 'Check the Socket Mode connection status.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'ask_human',
        description: `Ask a human for information that only they would know.
        
        Use this tool when you need information such as:
        - Personal preferences
        - Project-specific context  
        - Local environment details
        - Non-public information`,
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The question to ask the human. Be specific and provide context.',
            },
          },
          required: ['question'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'ping': {
        return {
          content: [
            {
              type: 'text',
              text: `Pong! MCP server is responding. Time: ${new Date().toISOString()}`,
            },
          ],
        };
      }
      
      case 'check_environment': {
        const envInfo: string[] = [];
        
        // Show current configuration (masked for security)
        const configItems = [
          { name: 'SLACK_BOT_TOKEN', value: currentConfig.slackBotToken },
          { name: 'SLACK_APP_TOKEN', value: currentConfig.slackAppToken },
          { name: 'SLACK_CHANNEL_ID', value: currentConfig.slackChannelId },
          { name: 'SLACK_USER_ID', value: currentConfig.slackUserId },
          { name: 'LOG_LEVEL', value: currentConfig.logLevel || 'INFO' },
        ];

        for (const { name, value } of configItems) {
          if (value) {
            // Mask tokens for security but show first/last chars
            let masked: string;
            if (name.includes('TOKEN') && value.length > 10) {
              masked = value.slice(0, 5) + '...' + value.slice(-3);
            } else if (name.includes('TOKEN')) {
              masked = value.slice(0, 3) + '...';
            } else {
              // Don't mask IDs and log level
              masked = value;
            }
            envInfo.push(`${name}: ${masked} (length: ${value.length})`);
          } else {
            envInfo.push(`${name}: NOT SET`);
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: 'Current configuration:\n' + envInfo.join('\n'),
            },
          ],
        };
      }

      case 'test_slack_connection': {
        if (!human.handler) {
          // Initialize handler if not already done
          logger.info('Initializing Slack handler for test...');
          
          if (human instanceof SimpleHumanInSlack) {
            const slackHandler = new SimpleSlackHandler(currentConfig.slackBotToken);
            human.setHandler(slackHandler);
            
            try {
              await slackHandler.start();
              logger.info(`Simple Slack handler initialized for test: isReady=${slackHandler.isReady}`);
            } catch (error) {
              logger.error(`Failed to initialize Simple Slack handler: ${error}`);
              const errorDetails = error instanceof Error ? error.stack || error.message : String(error);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: Failed to initialize Slack for test: ${errorDetails}`,
                  },
                ],
              };
            }
          } else {
            const slackHandler = new SlackHandler(currentConfig.slackBotToken, currentConfig.slackAppToken);
            (human as HumanInSlack).setHandler(slackHandler);
            
            try {
              await slackHandler.start();
              logger.info(`Slack handler initialized for test: isReady=${slackHandler.isReady}`);
            } catch (error) {
              logger.error(`Failed to initialize Slack handler: ${error}`);
              const errorDetails = error instanceof Error ? error.stack || error.message : String(error);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: Failed to initialize Slack for test: ${errorDetails}`,
                  },
                ],
              };
            }
          }
        }
        
        if (!human.handler!.isReady) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Slack handler not ready after initialization',
              },
            ],
          };
        }

        try {
          const result = await human.handler!.webClient.chat.postMessage({
            channel: config.slackChannelId,
            text: '🧪 Test message - please type anything in this channel to test message reception',
          });

          if (result.ok) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Test message sent successfully. Please type a message in channel ${config.slackChannelId} and check server logs for reception.`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed to send test message: ${result.error}`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error sending test message: ${String(error)}`,
              },
            ],
          };
        }
      }

      case 'check_message_log': {
        if (!human.handler) {
          return {
            content: [
              {
                type: 'text',
                text: 'No handler initialized yet. The handler will be initialized when ask_human is first called.',
              },
            ],
          };
        }
        
        const messageLog = human.getMessageLog();
        const eventCount = human.getEventCount();

        if (messageLog.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No messages received yet. Total events processed: ${eventCount}`,
              },
            ],
          };
        }

        let logSummary = `Total events: ${eventCount}\n`;
        logSummary += `Messages logged: ${messageLog.length}\n\n`;
        logSummary += 'Recent messages:\n';

        for (const msg of messageLog.slice(-10)) {
          logSummary += `- ${msg.timestamp}: `;
          logSummary += `Channel=${msg.channel || 'N/A'}, `;
          logSummary += `User=${msg.user || 'N/A'}, `;
          logSummary += `Text='${msg.text}', `;
          logSummary += `Thread=${msg.threadTs || 'None'}, `;
          logSummary += `IsBot=${msg.botId != null}\n`;
        }

        return {
          content: [
            {
              type: 'text',
              text: logSummary,
            },
          ],
        };
      }

      case 'check_socket_status': {
        const statusInfo: string[] = [];

        // Check handler exists
        if (!human.handler) {
          statusInfo.push('Handler exists: ❌ (Not initialized yet - will initialize on first ask_human call)');
          return {
            content: [
              {
                type: 'text',
                text: statusInfo.join('\n'),
              },
            ],
          };
        }

        statusInfo.push('Handler exists: ✅');
        statusInfo.push(`Handler isReady: ${human.handler.isReady}`);

        // Check socket client (only for SlackHandler, not SimpleSlackHandler)
        if ('socketClient' in human.handler) {
          statusInfo.push('Socket client exists: ✅');

          const sessionId = (human.handler.socketClient as any)._sessionId;
          statusInfo.push(`Session ID: ${sessionId || 'None'}`);

          // Check if connected
          try {
            const isConnected = human.handler.socketClient.connected;
            statusInfo.push(`Is connected: ${isConnected}`);
          } catch (error) {
            statusInfo.push(`Is connected: Error - ${String(error)}`);
          }
        } else {
          statusInfo.push('Socket client exists: ❌ (Using Simple Web API mode)');
        }

        // Check web client
        if (human.handler.webClient) {
          statusInfo.push('Web client exists: ✅');
        } else {
          statusInfo.push('Web client exists: ❌');
        }

        return {
          content: [
            {
              type: 'text',
              text: statusInfo.join('\n'),
            },
          ],
        };
      }

      case 'ask_human': {
        const { question } = args as { question: string };
        
        // Version check to ensure new code is running
        const currentTime = Math.floor(Date.now() / 1000);

        // Initialize handler on demand if not set
        if (!human.handler) {
          logger.info('Initializing Slack handler on demand...');
          
          if (human instanceof SimpleHumanInSlack) {
            const slackHandler = new SimpleSlackHandler(currentConfig.slackBotToken);
            human.setHandler(slackHandler);
            
            try {
              await slackHandler.start();
              logger.info(`Simple Slack handler initialized: isReady=${slackHandler.isReady}`);
            } catch (error) {
              logger.error(`Failed to initialize Simple Slack handler: ${error}`);
              const errorDetails = error instanceof Error ? error.stack || error.message : String(error);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: Failed to initialize Slack: ${errorDetails} [Code version: ${currentTime}]`,
                  },
                ],
              };
            }
          } else {
            const slackHandler = new SlackHandler(currentConfig.slackBotToken, currentConfig.slackAppToken);
            (human as HumanInSlack).setHandler(slackHandler);
            
            try {
              await slackHandler.start();
              logger.info(`Slack handler initialized: isReady=${slackHandler.isReady}`);
            } catch (error) {
              logger.error(`Failed to initialize Slack handler: ${error}`);
              const errorDetails = error instanceof Error ? error.stack || error.message : String(error);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: Failed to initialize Slack: ${errorDetails} [Code version: ${currentTime}]`,
                  },
                ],
              };
            }
          }
        }

        // Check if connection is ready
        if (!human.handler!.isReady) {
          logger.info('Handler not ready, attempting dynamic connection...');

          try {
            // Verify web client authentication
            logger.info('Verifying web client authentication...');

            const currentBotToken = currentConfig.slackBotToken;
            const handlerToken = (human.handler!.webClient as any).token || 'NOT_SET';

            logger.info(`Current env bot token: ${currentBotToken.slice(0, 10)}...${currentBotToken.slice(-5)}`);
            logger.info(`Handler web client token: ${handlerToken.slice(0, 10)}...${handlerToken.slice(-5)}`);

            if (currentBotToken !== handlerToken) {
              logger.warn('Token mismatch detected between environment and handler!');
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: Token mismatch - env vs handler tokens differ [Code version: ${currentTime}]`,
                  },
                ],
              };
            }

            try {
              const authResult = await human.handler!.webClient.auth.test();
              logger.info(`Auth test result: ${authResult.ok}`);
              if (!authResult.ok) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Error: Slack auth failed: ${authResult.error || 'Unknown'} - Token: ${currentBotToken.slice(0, 10)}...${currentBotToken.slice(-5)} [Code version: ${currentTime}]`,
                    },
                  ],
                };
              }
            } catch (authError) {
              logger.error(`Auth test failed: ${authError}`);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error: Slack auth test failed: ${String(authError)} - Token: ${currentBotToken.slice(0, 10)}...${currentBotToken.slice(-5)} [Code version: ${currentTime}]`,
                  },
                ],
              };
            }

            // Check if socket client is connected (only for SlackHandler)
            if ('socketClient' in human.handler!) {
              const isConnected = human.handler!.socketClient.connected;
              if (!isConnected) {
                logger.info('Attempting to start socket client...');

                // Start the socket client
                await human.handler!.socketClient.start();
                logger.info('Socket start call completed');

                // Wait for connection establishment
                for (let i = 0; i < 20; i++) {
                  const connected = human.handler!.socketClient.connected;
                  logger.info(`Checking connection (attempt ${i + 1}): ${connected}`);

                  if (connected) {
                    logger.info('Socket connection established');
                    human.handler!.isReady = true;
                    break;
                  }
                  await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (!human.handler!.isReady) {
                  logger.warn('Socket connection failed to establish after 10 seconds');
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `Error: Socket session timeout [Code version: ${currentTime}]`,
                      },
                    ],
                  };
                }
              }
            }
          } catch (error) {
            logger.error(`Failed to establish socket connection: ${error}`);
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Socket connection failed: ${String(error)} [Code version: ${currentTime}]`,
                },
              ],
            };
          }
        }

        // Final check
        if (human.handler!.isReady) {
          logger.info('Connection ready, proceeding with ask');
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Slack not ready after retry [Code version: ${currentTime}]`,
              },
            ],
          };
        }

        try {
          const response = await human.ask(question);
          return {
            content: [
              {
                type: 'text',
                text: response,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error asking human: ${String(error)}`,
              },
            ],
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  // Run MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Human-in-the-Loop Slack MCP server started');
}

// グローバルエラーハンドラー
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack || '');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

main().catch((error) => {
  logger.error(`Fatal error: ${error}`);
  logger.error(error.stack || '');
  process.exit(1);
});