import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { CoinGeckoService } from "./services/coingecko.js";
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
    interval: z.enum(["5m", "hourly", "daily"]).optional(),
});
// Add schema for OHLC arguments
const GetOHLCDataArgumentsSchema = z.object({
    id: z.string(),
    vs_currency: z.string(),
    from: z.number(),
    to: z.number(),
    interval: z.enum(["daily", "hourly"])
});
export class CoinGeckoMCPServer {
    server;
    coinGeckoService;
    constructor(apiKey) {
        this.coinGeckoService = new CoinGeckoService(apiKey);
        // Initialize MCP server
        this.server = new Server({
            name: "coingecko",
            version: "1.0.0",
        }, {
            capabilities: {
                tools: {},
            },
        });
        // Set up request handlers
        this.setupRequestHandlers();
        // Initialize cache
        this.coinGeckoService.refreshCoinList().catch((error) => {
            console.error("Failed to initialize coin cache:", error);
            process.exit(1);
        });
    }
    setupRequestHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "get-coins",
                        description: `Get a paginated list of all supported coins on CoinGecko. Data up to ${new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}`,
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
                        description: `Find CoinGecko IDs for a list of coin names or symbols. Data up to ${new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}`,
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
                        name: "get-historical-data",
                        description: `Get historical price, market cap, and volume data for a specific coin. Data up to ${new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}`,
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
                    {
                        name: "refresh-cache",
                        description: "Refresh the cached list of coins from CoinGecko",
                        inputSchema: {
                            type: "object",
                            properties: {},
                        },
                    },
                    {
                        name: "get-ohlc-data",
                        description: `Get OHLC (Open, High, Low, Close) data for a specific coin within a time range. Data up to ${new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}`,
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
                                    enum: ["daily", "hourly"],
                                    description: "Data interval - daily (up to 180 days) or hourly (up to 31 days)",
                                },
                            },
                            required: ["id", "vs_currency", "from", "to", "interval"],
                        },
                    },
                ],
            };
        });
        // Handle tool execution
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                if (name === "get-coins") {
                    const { page = 1, pageSize = 100 } = GetCoinsArgumentsSchema.parse(args);
                    const coins = this.coinGeckoService.getCoins(page, pageSize);
                    const totalPages = this.coinGeckoService.getTotalPages(pageSize);
                    const lastUpdated = this.coinGeckoService.getLastUpdated();
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
                    const results = this.coinGeckoService.findCoinIds(coins);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(results, null, 2),
                            },
                        ],
                    };
                }
                if (name === "get-historical-data") {
                    const { id, vs_currency, from, to, interval } = GetHistoricalDataArgumentsSchema.parse(args);
                    const data = await this.coinGeckoService.getHistoricalData(id, vs_currency, from, to, interval);
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
                                    data,
                                }, null, 2),
                            },
                        ],
                    };
                }
                if (name === "refresh-cache") {
                    await this.coinGeckoService.refreshCoinList();
                    const lastUpdated = this.coinGeckoService.getLastUpdated();
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Cache refreshed successfully at ${lastUpdated?.toISOString()}`,
                            },
                        ],
                    };
                }
                if (name === "get-ohlc-data") {
                    const { id, vs_currency, from, to, interval } = GetOHLCDataArgumentsSchema.parse(args);
                    const data = await this.coinGeckoService.getOHLCData(id, vs_currency, from, to, interval);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    timeRange: {
                                        from: new Date(from * 1000).toISOString(),
                                        to: new Date(to * 1000).toISOString(),
                                    },
                                    interval,
                                    data,
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
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("CoinGecko MCP Server running on stdio");
    }
}
