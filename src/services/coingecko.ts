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
  
  export interface OHLCData {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
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
  
    private validateDateRange(fromDate: string, toDate: string) {
      const now = new Date();
      const from = new Date(fromDate);
      const to = new Date(toDate);
      
      if (from > now || to > now) {
        throw new Error("Cannot request future dates");
      }
      if (from > to) {
        throw new Error("Start date must be before end date");
      }
    }
  
    async getHistoricalDataByDate(
      id: string,
      vs_currency: string,
      fromDate: string,  // Format: YYYY-MM-DD
      toDate: string,    // Format: YYYY-MM-DD
      interval?: "5m" | "hourly" | "daily"
    ): Promise<HistoricalData> {
      this.validateDateRange(fromDate, toDate);
      
      // Convert dates to timestamps
      const from = Math.floor(new Date(fromDate).getTime() / 1000);
      const to = Math.floor(new Date(toDate).getTime() / 1000);
  
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
  
    async getOHLCDataByDate(
      id: string,
      vs_currency: string,
      fromDate: string,  // Format: YYYY-MM-DD
      toDate: string,    // Format: YYYY-MM-DD
      interval: "daily" | "hourly"
    ): Promise<OHLCData[]> {
      this.validateDateRange(fromDate, toDate);
      
      // Convert dates to timestamps
      const from = Math.floor(new Date(fromDate).getTime() / 1000);
      const to = Math.floor(new Date(toDate).getTime() / 1000);
  
      const url = `${this.baseUrl}/coins/${id}/ohlc/range?vs_currency=${vs_currency}&from=${from}&to=${to}&interval=${interval}`;
      console.error(`Making request to: ${url}`);
  
      try {
        const response = await fetch(url, {
          headers: {
            "X-Cg-Pro-Api-Key": this.apiKey,
            "accept": "application/json"
          },
        });
  
        if (!response.ok) {
          const responseText = await response.text();
          console.error(`API Response Status: ${response.status} ${response.statusText}`);
          console.error(`API Response Headers:`, Object.fromEntries(response.headers.entries()));
          console.error(`API Response Body:`, responseText);
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${responseText}`);
        }
  
        const data: number[][] = await response.json();
        
        // Transform the data into a more readable format
        // CoinGecko returns [timestamp, open, high, low, close]
        return data.map(([timestamp, open, high, low, close]) => ({
          timestamp,
          open,
          high,
          low,
          close
        }));
      } catch (error) {
        console.error("Error fetching OHLC data:", error);
        throw error;
      }
    }
  
    // Convenience methods for common time ranges
    async getLast7Days(id: string, vs_currency: string): Promise<HistoricalData> {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      
      return this.getHistoricalDataByDate(
        id,
        vs_currency,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
        'daily'
      );
    }
  
    async getLast30Days(id: string, vs_currency: string): Promise<HistoricalData> {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      
      return this.getHistoricalDataByDate(
        id,
        vs_currency,
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
        'daily'
      );
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
      const currentDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
      
      return [
        {
          name: "get_coins",
          description: `Get a paginated list of all supported coins on CoinGecko. Data up to ${new Date().toLocaleDateString(
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
              page: {
                type: "number",
                description: "Page number (starts from 1, default: 1)",
                minimum: 1
              },
              pageSize: {
                type: "number",
                description: "Results per page (default: 100, max: 1000)",
                minimum: 1,
                maximum: 1000
              },
            },
          },
        },
        {
          name: "find_coin_ids",
          description: `Find CoinGecko IDs for a list of coin names or symbols. Data up to ${new Date().toLocaleDateString(
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
              coins: {
                type: "array",
                items: {
                  type: "string",
                },
                description: "Array of coin names or symbols to search for (e.g., ['BTC', 'ethereum', 'DOT'])",
                maxItems: 100
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
                description: "CoinGecko coin ID (use find_coin_ids to lookup)",
              },
              vs_currency: {
                type: "string",
                description: "Target currency (e.g., 'usd', 'eur')",
              },
              from_date: {
                type: "string",
                description: "Start date in YYYY-MM-DD format (e.g., '2024-01-01')",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
              },
              to_date: {
                type: "string",
                description: "End date in YYYY-MM-DD format (e.g., '2024-12-30')",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
              },
              interval: {
                type: "string",
                enum: ["5m", "hourly", "daily"],
                description: "Data interval - affects maximum time range: 5m (up to 1 day), hourly (up to 90 days), daily (up to 365 days)",
              },
            },
            required: ["id", "vs_currency", "from_date", "to_date"],
          },
        },
        {
          name: "refresh_cache",
          description: "Manually update the local cache of CoinGecko coin data (automatically refreshed periodically, only needed if seeing stale data)",
          parameters: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "get_ohlc_data",
          description: `Get OHLC (Open, High, Low, Close) candlestick data for a specific coin within a time range. Data up to ${new Date().toLocaleDateString(
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
                description: "CoinGecko coin ID (use find_coin_ids to lookup)",
              },
              vs_currency: {
                type: "string",
                description: "Target currency (e.g., 'usd', 'eur')",
              },
              from_date: {
                type: "string",
                description: "Start date in YYYY-MM-DD format (e.g., '2024-01-01')",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
              },
              to_date: {
                type: "string", 
                description: "End date in YYYY-MM-DD format (e.g., '2024-12-30')",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$"
              },
              interval: {
                type: "string",
                enum: ["daily", "hourly"],
                description: "Data interval - daily (up to 180 days) or hourly (up to 31 days)",
              },
            },
            required: ["id", "vs_currency", "from_date", "to_date", "interval"],
          },
        },
      ];
    }
  }