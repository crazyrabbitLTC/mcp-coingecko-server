// src/services/coingecko.ts

export interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
  platforms?: Record<string, string>;
}

export interface HistoricalData {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export class CoinGeckoService {
  private coins: CoinInfo[] = [];
  private lastUpdated: Date | null = null;
  private readonly baseUrl = "https://pro-api.coingecko.com/api/v3";

  constructor(private apiKey: string) {}

  // Core data fetching methods
  async refreshCoinList(): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/coins/list?include_platform=true`,
        {
          headers: {
            "X-Cg-Pro-Api-Key": this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      this.coins = await response.json();
      this.lastUpdated = new Date();
    } catch (error) {
      console.error("Error refreshing coin cache:", error);
      throw error;
    }
  }

  async getHistoricalData(
    id: string,
    vs_currency: string,
    from: number,
    to: number,
    interval?: "5m" | "hourly" | "daily"
  ): Promise<HistoricalData> {
    let url = `${this.baseUrl}/coins/${id}/market_chart/range?vs_currency=${vs_currency}&from=${from}&to=${to}`;
    if (interval) {
      url += `&interval=${interval}`;
    }

    try {
      const response = await fetch(url, {
        headers: {
          "X-Cg-Pro-Api-Key": this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching historical data:", error);
      throw error;
    }
  }

  // Utility methods for accessing cached data
  getCoins(page: number = 1, pageSize: number = 100): CoinInfo[] {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return this.coins.slice(start, end);
  }

  findCoinIds(coinNames: string[]): { name: string; id: string | null }[] {
    return coinNames.map((name) => {
      const normalizedName = name.toLowerCase();
      const coin = this.coins.find(
        (c) =>
          c.name.toLowerCase() === normalizedName ||
          c.symbol.toLowerCase() === normalizedName
      );
      return {
        name,
        id: coin?.id || null,
      };
    });
  }

  getTotalPages(pageSize: number = 100): number {
    return Math.ceil(this.coins.length / pageSize);
  }

  getLastUpdated(): Date | null {
    return this.lastUpdated;
  }

  // Function calling schema definitions for different LLM providers
  static getOpenAIFunctionDefinitions() {
    return [
      {
        name: "get_coins",
        description: "Get a paginated list of all supported coins on CoinGecko",
        parameters: {
          type: "object",
          properties: {
            page: {
              type: "number",
              description: "Page number (starts from 1)",
            },
            pageSize: {
              type: "number",
              description: "Number of items per page (max 1000)",
            },
          },
        },
      },
      {
        name: "find_coin_ids",
        description: "Find CoinGecko IDs for a list of coin names or symbols",
        parameters: {
          type: "object",
          properties: {
            coins: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of coin names or symbols to look up",
            },
          },
          required: ["coins"],
        },
      },
      {
        name: "get_historical_data",
        description: `Get historical price, market cap, and volume data for a specific coin. Data up to ${new Date().toLocaleDateString(
          "en-US",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        )}`,
        parameters: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "CoinGecko coin ID",
            },
            vs_currency: {
              type: "string",
              description: "Target currency (e.g., 'usd', 'eur')",
            },
            from: {
              type: "number",
              description: "Start timestamp (UNIX)",
            },
            to: {
              type: "number",
              description: "End timestamp (UNIX)",
            },
            interval: {
              type: "string",
              enum: ["5m", "hourly", "daily"],
              description: "Data interval (optional)",
            },
          },
          required: ["id", "vs_currency", "from", "to"],
        },
      },
      {
        name: "refresh_cache",
        description: "Refresh the cached list of coins from CoinGecko",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ];
  }
}
