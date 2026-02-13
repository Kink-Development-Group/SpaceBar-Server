/*
	Spacebar: A FOSS re-implementation and extension of the Discord.com backend.
	Copyright (C) 2023 Spacebar and Spacebar Contributors
	
	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published
	by the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { WebSocket } from "./WebSocket";
import { CLOSECODES } from "./Constants";

/**
 * Gateway rate limiter per WebSocket connection.
 * Discord's Gateway rate limit: 120 commands per 60 seconds.
 * Exceeding the limit closes the connection with Rate_limited (4008).
 */

export interface GatewayRateLimitConfig {
    maxCommands: number; // max commands in the window (default: 120)
    windowMs: number; // window duration in ms (default: 60000)
    maxConnectionsPerIp: number; // max concurrent connections per IP (default: 50)
}

export const DEFAULT_GATEWAY_RATE_LIMIT: GatewayRateLimitConfig = {
    maxCommands: 120,
    windowMs: 60000,
    maxConnectionsPerIp: 50,
};

interface RateLimitState {
    commands: number;
    windowStart: number;
}

const rateLimitStates = new WeakMap<WebSocket, RateLimitState>();
const connectionsPerIp = new Map<string, number>();

/**
 * Initialize rate limit state for a new WebSocket connection.
 * Also tracks connections per IP and rejects if the limit is exceeded.
 * Returns false if the connection should be rejected (too many connections from this IP).
 */
export function initGatewayRateLimit(socket: WebSocket, config: GatewayRateLimitConfig = DEFAULT_GATEWAY_RATE_LIMIT): boolean {
    rateLimitStates.set(socket, {
        commands: 0,
        windowStart: Date.now(),
    });

    const ip = socket.ipAddress || "unknown";
    const current = connectionsPerIp.get(ip) || 0;

    if (current >= config.maxConnectionsPerIp) {
        return false; // reject connection
    }

    connectionsPerIp.set(ip, current + 1);
    return true;
}

/**
 * Check if a command should be rate limited.
 * Returns true if the command is allowed, false if rate limited (and closes the socket).
 */
export function checkGatewayRateLimit(socket: WebSocket, config: GatewayRateLimitConfig = DEFAULT_GATEWAY_RATE_LIMIT): boolean {
    const state = rateLimitStates.get(socket);
    if (!state) return true; // no state = not initialized, allow

    const now = Date.now();

    // Reset window if expired
    if (now - state.windowStart >= config.windowMs) {
        state.commands = 0;
        state.windowStart = now;
    }

    state.commands++;

    if (state.commands > config.maxCommands) {
        console.warn(`[Gateway] Rate limited connection from ${socket.ipAddress} (${state.commands} commands in window)`);
        socket.close(CLOSECODES.Rate_limited);
        return false;
    }

    return true;
}

/**
 * Clean up rate limit state when a connection closes.
 */
export function cleanupGatewayRateLimit(socket: WebSocket): void {
    rateLimitStates.delete(socket);

    const ip = socket.ipAddress || "unknown";
    const current = connectionsPerIp.get(ip) || 0;
    if (current <= 1) {
        connectionsPerIp.delete(ip);
    } else {
        connectionsPerIp.set(ip, current - 1);
    }
}
