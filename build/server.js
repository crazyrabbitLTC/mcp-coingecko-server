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
// New date string validation
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format. Use YYYY-MM-DD");
const GetHistoricalDataArgumentsSchema = z.object({
    id: z.string(),
    vs_currency: z.string(),
    from_date: DateString,
    to_date: DateString,
    interval: z.enum(["5m", "hourly", "daily"]).optional(),
});
const GetOHLCDataArgumentsSchema = z.object({
    id: z.string(),
    vs_currency: z.string(),
    from_date: DateString,
    to_date: DateString,
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
                        name: "find-coin-ids",
                        description: `Find CoinGecko IDs for a list of coin names or symbols (case-insensitive). Data up to ${new Date().toLocaleDateString('en-US', {
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
                                    description: "Array of coin names or symbols to search for (e.g., ['BTC', 'ethereum', 'DOT'])",
                                    maxItems: 100
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
                                    description: "CoinGecko coin ID (use find-coin-ids to lookup)",
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
                        name: "refresh-cache",
                        description: "Manually update the local cache of CoinGecko coin data (automatically refreshed periodically, only needed if seeing stale data)",
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
                                    description: "CoinGecko coin ID (use find-coin-ids to lookup)",
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
                    const { id, vs_currency, from_date, to_date, interval } = GetHistoricalDataArgumentsSchema.parse(args);
                    const data = await this.coinGeckoService.getHistoricalDataByDate(id, vs_currency, from_date, to_date, interval);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    timeRange: {
                                        from: from_date,
                                        to: to_date,
                                        currentTime: new Date().toISOString()
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
                    const { id, vs_currency, from_date, to_date, interval } = GetOHLCDataArgumentsSchema.parse(args);
                    const data = await this.coinGeckoService.getOHLCDataByDate(id, vs_currency, from_date, to_date, interval);
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    timeRange: {
                                        from: from_date,
                                        to: to_date,
                                        currentTime: new Date().toISOString()
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
