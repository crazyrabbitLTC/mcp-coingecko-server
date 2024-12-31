// src/index.ts
import { CoinGeckoMCPServer } from "./server.js";
import { CoinGeckoService } from "./services/coingecko.js";
import * as dotenv from 'dotenv';
dotenv.config();

// Export for use as a library
export { CoinGeckoService, CoinGeckoMCPServer };

// Run as standalone server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const apiKey = process.env.COINGECKO_API_KEY;

  if (!apiKey) {
    console.error("COINGECKO_API_KEY is not set in the environment variables");
    process.exit(1);
  }

  const server = new CoinGeckoMCPServer(apiKey);
  server.start().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}