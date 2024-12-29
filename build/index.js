import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();
// Cache management
class CoinCache {
    apiKey;
    coins = [];
    lastUpdated = null;
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    async getHistoricalData(id, vs_currency, from, to, interval) {
        const baseUrl = 'https://pro-api.coingecko.com/api/v3/coins';
        let url = `${baseUrl}/${id}/market_chart/range?vs_currency=${vs_currency}&from=${from}&to=${to}`;
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
    async refreshCache() {
        try {
            const response = await fetch("https://pro-api.coingecko.com/api/v3/coins/list?include_platform=true", {
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
    getCoins(page = 1, pageSize = 100) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return this.coins.slice(start, end);
    }
    findCoinIds(coinNames) {
        return coinNames.map(name => {
            const normalizedName = name.toLowerCase();
            const coin = this.coins.find(c => c.name.toLowerCase() === normalizedName ||
                c.symbol.toLowerCase() === normalizedName);
            return {
                name,
                id: coin?.id || null
            };
        });
    }
    getTotalPages(pageSize = 100) {
        return Math.ceil(this.coins.length / pageSize);
    }
    getLastUpdated() {
        return this.lastUpdated;
    }
}
// Input validation schemas
const GetCoinsArgumentsSchema = z.object({
    page: z.number().min(1).optional(),
    pageSize: z.number().min(1).max(1000).optional(),
});
const FindCoinIdsArgumentsSchema = z.object({
    coins: z.array(z.string()),
});
const GetHistoricalDataArgumentsSchema = z.object({
    id: z.string(),
    vs_currency: z.string(),
    from: z.number(),
    to: z.number(),
    interval: z.enum(['5m', 'hourly', 'daily']).optional(),
});
// Server setup
const apiKey = process.env.COINGECKO_API_KEY;
if (!apiKey) {
    throw new Error("COINGECKO_API_KEY environment variable is required");
}
const cache = new CoinCache(apiKey);
const server = new Server({
    name: "coingecko",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Initialize cache on startup
cache.refreshCache().catch(error => {
    console.error("Failed to initialize coin cache:", error);
    process.exit(1);
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get-coins",
                description: "Get a paginated list of all supported coins on CoinGecko",
                inputSchema: {
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
                name: "find-coin-ids",
                description: "Find CoinGecko IDs for a list of coin names or symbols",
                inputSchema: {
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
                name: "refresh-cache",
                description: "Refresh the cached list of coins from CoinGecko",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "get-historical-data",
                description: "Get historical price, market cap, and volume data for a specific coin",
                inputSchema: {
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
        ],
    };
});
// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        if (name === "get-coins") {
            const { page = 1, pageSize = 100 } = GetCoinsArgumentsSchema.parse(args);
            const coins = cache.getCoins(page, pageSize);
            const totalPages = cache.getTotalPages(pageSize);
            const lastUpdated = cache.getLastUpdated();
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            coins,
                            pagination: {
                                currentPage: page,
                                totalPages,
                                pageSize,
                            },
                            lastUpdated: lastUpdated?.toISOString(),
                        }, null, 2),
                    },
                ],
            };
        }
        if (name === "find-coin-ids") {
            const { coins } = FindCoinIdsArgumentsSchema.parse(args);
            const results = cache.findCoinIds(coins);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(results, null, 2),
                    },
                ],
            };
        }
        if (name === "refresh-cache") {
            await cache.refreshCache();
            const lastUpdated = cache.getLastUpdated();
            return {
                content: [
                    {
                        type: "text",
                        text: `Cache refreshed successfully at ${lastUpdated?.toISOString()}`,
                    },
                ],
            };
        }
        if (name === "get-historical-data") {
            const { id, vs_currency, from, to, interval } = GetHistoricalDataArgumentsSchema.parse(args);
            const data = await cache.getHistoricalData(id, vs_currency, from, to, interval);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            timeRange: {
                                from: new Date(from * 1000).toISOString(),
                                to: new Date(to * 1000).toISOString(),
                            },
                            interval: interval || "auto",
                            data
                        }, null, 2),
                    },
                ],
            };
        }
        throw new Error(`Unknown tool: ${name}`);
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`Invalid arguments: ${error.errors
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join(", ")}`);
        }
        throw error;
    }
});
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("CoinGecko MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
