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

  // Tool: ask_on_slack only
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'ask_on_slack',
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
      case 'ask_on_slack': {
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