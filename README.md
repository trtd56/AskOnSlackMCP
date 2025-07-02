# Human-in-the-Loop Slack MCP Server

A Model Context Protocol (MCP) server that enables AI assistants to request information from humans via Slack. This server acts as a bridge between AI systems and human experts, allowing AI to ask questions and receive responses through Slack when it needs human knowledge or clarification.

## Quick Start with npx

Run directly from GitHub without installation:

```bash
npx github:trtd56/AskOnSlackMCP \
  --slack-bot-token "xoxb-your-bot-token" \
  --slack-app-token "xapp-your-app-token" \
  --slack-channel-id "C1234567890" \
  --slack-user-id "U1234567890"
```

### Example with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "slack-human": {
      "command": "npx",
      "args": [
        "github:trtd56/AskOnSlackMCP",
        "--slack-bot-token", "xoxb-your-actual-token",
        "--slack-app-token", "xapp-your-actual-token", 
        "--slack-channel-id", "C1234567890",
        "--slack-user-id", "U1234567890"
      ]
    }
  }
}
```

## Features

- 🤖 MCP-compliant server for AI assistant integration
- 💬 Real-time Slack integration via Socket Mode WebSocket connection
- 🧵 Thread-based conversations for maintaining context
- ⏱️ 60-second timeout for human responses
- 📢 User mentions (`@username`) for notifications
- 🔍 Comprehensive debugging and logging capabilities
- 🔐 Secure token handling
- 🚀 Dynamic handler initialization for faster startup
- ⚡ Optimized for instant response detection with event-driven architecture

## Prerequisites

1. **Slack App Setup**
   - Create a new Slack app at https://api.slack.com/apps
   - Enable Socket Mode in your app settings
   - Generate an App-Level Token with `connections:write` scope
   - Install the app to your workspace

2. **Bot Token Scopes**
   - `chat:write` - Send messages
   - `channels:read` - Access channel information
   - `users:read` - Access user information

3. **Socket Mode**
   - Enable Socket Mode in your app settings
   - This is required for the app to receive events in real-time

4. **Event Subscriptions**
   - Enable Events API
   - Subscribe to bot events:
     - `message.channels` - Messages in public channels
     - `message.groups` - Messages in private channels
     - `message.im` - Direct messages (optional)
   - Save changes and reinstall the app to your workspace

## Installation (Optional)

If you want to install locally instead of using npx:

1. Clone the repository:
```bash
git clone https://github.com/trtd56/AskOnSlackMCP.git
cd AskOnSlackMCP
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

## Configuration

All configuration is passed via command-line arguments:

- `--slack-bot-token` - Bot User OAuth Token (xoxb-...)
- `--slack-app-token` - App-Level Token for Socket Mode (xapp-...)
- `--slack-channel-id` - Channel ID where the bot will operate
- `--slack-user-id` - User ID to mention when asking questions
- `--log-level` - (Optional) Logging level (default: INFO)

## Usage

### Development Mode

Run with hot-reloading:
```bash
npm run dev
```

### Production Mode

Build and run:
```bash
npm run build
npm start
```

### With MCP Client (Using npx)

Configure your MCP client to use this server directly from GitHub:

```json
{
  "mcpServers": {
    "human-in-the-loop-slack": {
      "command": "npx",
      "args": [
        "github:trtd56/AskOnSlackMCP",
        "--slack-bot-token", "xoxb-your-token",
        "--slack-app-token", "xapp-your-token",
        "--slack-channel-id", "C1234567890",
        "--slack-user-id", "U1234567890"
      ]
    }
  }
}
```

### With MCP Client (Local Installation)

If you've installed locally:

```json
{
  "mcpServers": {
    "human-in-the-loop-slack": {
      "command": "node",
      "args": [
        "/path/to/AskOnSlackMCP/dist/index.js",
        "--slack-bot-token", "xoxb-your-token",
        "--slack-app-token", "xapp-your-token",
        "--slack-channel-id", "C1234567890",
        "--slack-user-id", "U1234567890"
      ]
    }
  }
}
```

## Available Tools

### `ask_on_slack`
Main tool for asking questions to humans via Slack.

**Parameters:**
- `question` (string): The question to ask the human. Be specific and provide context.

**Example:**
```json
{
  "tool": "ask_on_slack",
  "arguments": {
    "question": "What is the API endpoint for the production server?"
  }
}
```

**Usage Notes:**
- The bot will mention the specified user in the Slack channel
- The human has 60 seconds to respond in a thread
- The tool will return the human's response or timeout after 60 seconds

## Development

### Scripts

- `npm run build` - Compile TypeScript
- `npm run dev` - Run with hot-reloading
- `npm start` - Run compiled code
- `npm test` - Run tests with Vitest
- `npm run test:ci` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run clean` - Clean build artifacts

### Project Structure

```
src/
├── index.ts                  # Main MCP server implementation
├── bin.ts                    # Binary entry point for npx execution
├── human.ts                  # Abstract Human interface
├── slack-client.ts           # Socket Mode Slack implementation
└── types.ts                  # TypeScript type definitions

tests/
├── human.test.ts             # Human abstract class tests
├── index.test.ts             # CLI argument parsing tests
├── slack-client.test.ts      # Slack client tests
└── types.test.ts             # Type definition tests
```

### Testing

The project uses Vitest for testing. Tests are located in the `tests/` directory.

To run tests:
```bash
npm test              # Run tests in watch mode
npm run test:ci       # Run tests once with coverage
```

### CI/CD

The project uses GitHub Actions for continuous integration and deployment.

- **CI Workflow** (`ci.yml`): Runs on every push and pull request
  - Tests on Node.js 18.x, 20.x, and 22.x
  - Runs linting and type checking
  - Generates code coverage reports
  - Builds the project

- **Release Workflow** (`release.yml`): Runs on version tags
  - Builds and tests the project
  - Creates GitHub releases
  - Publishes to npm (requires NPM_TOKEN secret)

## Troubleshooting

1. **Connection Issues**
   - Verify all tokens are correct
   - Check that the bot is invited to the channel
   - Ensure Socket Mode is enabled in your Slack app

2. **No Response Received**
   - Verify the user ID is correct (format: U1234567890)
   - Ensure the user responds in the message thread, not the main channel
   - Check that the bot has permission to read messages in the channel

3. **Authentication Errors**
   - Bot token should start with `xoxb-`
   - App token should start with `xapp-`
   - Regenerate tokens if needed
   - Verify bot has required scopes: `chat:write`, `channels:read`, `users:read`

4. **Performance Optimization**
   - The server uses event-driven architecture for instant response detection
   - WebSocket connection ensures real-time message delivery
   - Detailed timing logs available with `[TIMING]` prefix for debugging

## License

MIT