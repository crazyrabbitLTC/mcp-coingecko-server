// src/services/coingecko.ts
export class CoinGeckoService {
    apiKey;
    coins = [];
    lastUpdated = null;
    baseUrl = "https://pro-api.coingecko.com/api/v3";
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    // Core data fetching methods
    async refreshCoinList() {
        try {
            const response = await fetch(`${this.baseUrl}/coins/list?include_platform=true`, {
                headers: {
                    "X-Cg-Pro-Api-Key": this.apiKey,
                },
            });
            if (!response.ok) {
                throw new Error(`API request failed: ${response.statusText}`);
            }
            this.coins = await response.json();
            this.lastUpdated = new Date();
        }
        catch (error) {
            console.error("Error refreshing coin cache:", error);
            throw error;
        }
    }
    async getHistoricalData(id, vs_currency, from, to, interval) {
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
        }
        catch (error) {
            console.error("Error fetching historical data:", error);
            throw error;
        }
    }
    async getOHLCData(id, vs_currency, from, to, interval) {
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
            const data = await response.json();
            // Transform the data into a more readable format
            // CoinGecko returns [timestamp, open, high, low, close]
            return data.map(([timestamp, open, high, low, close]) => ({
                timestamp,
                open,
                high,
                low,
                close
            }));
        }
        catch (error) {
            console.error("Error fetching OHLC data:", error);
            throw error;
        }
    }
    // Utility methods for accessing cached data
    getCoins(page = 1, pageSize = 100) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return this.coins.slice(start, end);
    }
    findCoinIds(coinNames) {
        return coinNames.map((name) => {
            const normalizedName = name.toLowerCase();
            const coin = this.coins.find((c) => c.name.toLowerCase() === normalizedName ||
                c.symbol.toLowerCase() === normalizedName);
            return {
                name,
                id: coin?.id || null,
            };
        });
    }
    getTotalPages(pageSize = 100) {
        return Math.ceil(this.coins.length / pageSize);
    }
    getLastUpdated() {
        return this.lastUpdated;
    }
    // Function calling schema definitions for different LLM providers
    static getOpenAIFunctionDefinitions() {
        return [
            {
                name: "get_coins",
                description: `Get a paginated list of all supported coins on CoinGecko. Data up to ${new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                })}`,
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
                description: `Find CoinGecko IDs for a list of coin names or symbols. Data up to ${new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                })}`,
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
                description: `Get historical price, market cap, and volume data for a specific coin. Data up to ${new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                })}`,
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
            {
                name: "get_ohlc_data",
                description: `Get OHLC (Open, High, Low, Close) candlestick data for a specific coin within a time range. Data up to ${new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                })}`,
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
                            enum: ["daily", "hourly"],
                            description: "Data interval - daily (up to 180 days) or hourly (up to 31 days)",
                        },
                    },
                    required: ["id", "vs_currency", "from", "to", "interval"],
                },
            },
        ];
    }
}
