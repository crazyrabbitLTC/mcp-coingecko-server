# CoinGecko Server

A Model Context Protocol (MCP) server and OpenAI function calling service for interacting with the CoinGecko Pro API.

## Features

- Paginated list of supported cryptocurrencies
- Coin ID lookup by name or symbol
- Historical price, market cap, and volume data
- OHLC (Open, High, Low, Close) candlestick data
- Local coin cache with refresh capability

## Installation

```bash
npm install coingecko-server
```

## Environment Setup

Create a `.env` file in your project root:

```env
COINGECKO_API_KEY=your_api_key_here
```

## Usage with Claude Desktop

Claude Desktop provides full support for MCP features. To use this server:

1. Install [Claude Desktop](https://claude.ai/download)

2. Add to your Claude Desktop configuration:
   - On macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - On Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "coingecko": {
      "command": "node",
      "args": ["/path/to/coingecko-server/build/index.js"],
      "env": {
        "COINGECKO_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

3. Restart Claude Desktop

The server provides the following tools:
- `get-coins`: Get a paginated list of supported coins
- `find-coin-ids`: Look up CoinGecko IDs for coin names/symbols
- `get-historical-data`: Get historical price, market cap, and volume data
- `get-ohlc-data`: Get OHLC candlestick data
- `refresh-cache`: Refresh the local coin list cache

## Usage with OpenAI Function Calling

```typescript
import { CoinGeckoService } from 'coingecko-server';
import OpenAI from 'openai';

const openai = new OpenAI();
const coinGeckoService = new CoinGeckoService(process.env.COINGECKO_API_KEY);

// Get function definitions
const functions = CoinGeckoService.getOpenAIFunctionDefinitions();

// Example: Get historical data
const response = await openai.chat.completions.create({
  model: "gpt-4-turbo-preview",
  messages: [{ role: "user", content: "Get Bitcoin's price history for the last week" }],
  functions: [functions[2]], // get_historical_data function
  function_call: "auto",
});

if (response.choices[0].message.function_call) {
  const args = JSON.parse(response.choices[0].message.function_call.arguments);
  const history = await coinGeckoService.getHistoricalData(
    args.id,
    args.vs_currency,
    args.from,
    args.to,
    args.interval
  );
}
```

## Data Types

### OHLCData
```typescript
interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
```

### HistoricalData
```typescript
interface HistoricalData {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}
```

### CoinInfo
```typescript
interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string>;
}
```

## Rate Limits

Please refer to the [CoinGecko Pro API documentation](https://www.coingecko.com/api/documentation) for current rate limits and usage guidelines.

## License

MIT 