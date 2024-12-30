# CoinGecko Server

A Model Context Protocol (MCP) server and OpenAI function calling service for interacting with the CoinGecko Pro API.

## Features

- Paginated list of supported cryptocurrencies
- Coin ID lookup by name or symbol
- Historical price, market cap, and volume data
- OHLC (Open, High, Low, Close) candlestick data
- Local coin cache with refresh capability
- Support for both MCP and OpenAI function calling

## Installation

```bash
npm install coingecko-server
```

## Environment Setup

Create a `.env` file in your project root:

```env
COINGECKO_API_KEY=your_api_key_here
```

## Usage as MCP Server

### Starting the Server

```typescript
import { CoinGeckoMCPServer } from 'coingecko-server';

const server = new CoinGeckoMCPServer(process.env.COINGECKO_API_KEY);
server.start();
```

### Available Tools

1. **get-coins**
   - Get a paginated list of supported coins
   ```json
   {
     "page": 1,
     "pageSize": 100
   }
   ```

2. **find-coin-ids**
   - Look up CoinGecko IDs for coin names/symbols
   ```json
   {
     "coins": ["bitcoin", "ethereum"]
   }
   ```

3. **get-historical-data**
   - Get historical price, market cap, and volume data
   ```json
   {
     "id": "bitcoin",
     "vs_currency": "usd",
     "from": 1711296000,
     "to": 1711382400,
     "interval": "hourly"
   }
   ```

4. **get-ohlc-data**
   - Get OHLC candlestick data
   ```json
   {
     "id": "bitcoin",
     "vs_currency": "usd",
     "from": 1711296000,
     "to": 1711382400,
     "interval": "hourly"
   }
   ```
   - Supports intervals:
     - `hourly`: Up to 31 days of data
     - `daily`: Up to 180 days of data

5. **refresh-cache**
   - Refresh the local coin list cache
   ```json
   {}
   ```

## Usage with OpenAI Function Calling

### Setup

```typescript
import { CoinGeckoService } from 'coingecko-server';
import OpenAI from 'openai';

const openai = new OpenAI();
const coinGeckoService = new CoinGeckoService(process.env.COINGECKO_API_KEY);

// Get function definitions
const functions = CoinGeckoService.getOpenAIFunctionDefinitions();
```

### Available Functions

1. **get_coins**
   ```typescript
   const response = await openai.chat.completions.create({
     model: "gpt-4-turbo-preview",
     messages: [{ role: "user", content: "List the first page of cryptocurrencies" }],
     functions: [functions[0]], // get_coins function
     function_call: "auto",
   });

   if (response.choices[0].message.function_call) {
     const args = JSON.parse(response.choices[0].message.function_call.arguments);
     const coins = coinGeckoService.getCoins(args.page, args.pageSize);
   }
   ```

2. **find_coin_ids**
   ```typescript
   const response = await openai.chat.completions.create({
     model: "gpt-4-turbo-preview",
     messages: [{ role: "user", content: "Find IDs for Bitcoin and Ethereum" }],
     functions: [functions[1]], // find_coin_ids function
     function_call: "auto",
   });

   if (response.choices[0].message.function_call) {
     const args = JSON.parse(response.choices[0].message.function_call.arguments);
     const ids = coinGeckoService.findCoinIds(args.coins);
   }
   ```

3. **get_historical_data**
   ```typescript
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

4. **get_ohlc_data**
   ```typescript
   const response = await openai.chat.completions.create({
     model: "gpt-4-turbo-preview",
     messages: [{ role: "user", content: "Get Bitcoin's OHLC data for the last 24 hours" }],
     functions: [functions[4]], // get_ohlc_data function
     function_call: "auto",
   });

   if (response.choices[0].message.function_call) {
     const args = JSON.parse(response.choices[0].message.function_call.arguments);
     const ohlc = await coinGeckoService.getOHLCData(
       args.id,
       args.vs_currency,
       args.from,
       args.to,
       args.interval
     );
   }
   ```

5. **refresh_cache**
   ```typescript
   const response = await openai.chat.completions.create({
     model: "gpt-4-turbo-preview",
     messages: [{ role: "user", content: "Update the coin list" }],
     functions: [functions[3]], // refresh_cache function
     function_call: "auto",
   });

   if (response.choices[0].message.function_call) {
     await coinGeckoService.refreshCoinList();
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