# Human-in-the-Loop Slack MCP Server (TypeScript)

A TypeScript implementation of the Human-in-the-Loop MCP server that enables AI assistants to request information from humans via Slack.

## Quick Start with npx

Run directly from GitHub without installation:

```bash
npx github:YOUR_USERNAME/human-in-the-loop-slack-mcp \
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
        "github:YOUR_USERNAME/human-in-the-loop-slack-mcp",
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
- 💬 Real-time Slack communication using Socket Mode
- 🧵 Thread-based conversations for context
- ⏱️ 60-second timeout for human responses
- 🔍 Comprehensive debugging tools
- 🔐 Secure token handling

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

3. **Event Subscriptions**
   - Enable Events API
   - Subscribe to bot events:
     - `message.channels` - Messages in public channels
     - `message.groups` - Messages in private channels

## Installation (Optional)

If you want to install locally instead of using npx:

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/human-in-the-loop-slack-mcp.git
cd human-in-the-loop-slack-mcp
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
        "github:YOUR_USERNAME/human-in-the-loop-slack-mcp",
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
        "/path/to/human-in-the-loop-slack-mcp/dist/index.js",
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

### `ask_human`
Main tool for asking questions to humans via Slack.

**Parameters:**
- `question` (string): The question to ask the human

**Example:**
```json
{
  "tool": "ask_human",
  "arguments": {
    "question": "What is the API endpoint for the production server?"
  }
}
```

### `check_environment`
Debug tool to verify environment variables are set correctly.

### `test_slack_connection`
Send a test message to verify Slack connectivity.

### `check_message_log`
View the last 50 received Slack messages for debugging.

### `check_socket_status`
Check the Socket Mode connection status.

## Development

### Scripts

- `npm run build` - Compile TypeScript
- `npm run dev` - Run with hot-reloading
- `npm start` - Run compiled code
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run clean` - Clean build artifacts

### Project Structure

```
src/
├── index.ts         # Main MCP server implementation
├── slack-client.ts  # Slack client and handler
├── human.ts         # Abstract Human interface
└── types.ts         # TypeScript type definitions
```

## Troubleshooting

1. **Connection Issues**
   - Verify all tokens are correct
   - Check that the bot is invited to the channel
   - Ensure Socket Mode is enabled in your Slack app

2. **No Response Received**
   - Verify the user ID is correct
   - Ensure the user responds in the message thread
   - Check message logs with `check_message_log` tool

3. **Authentication Errors**
   - Regenerate tokens if needed
   - Verify bot has required scopes
   - Check environment variables with `check_environment` tool

## License

MIT