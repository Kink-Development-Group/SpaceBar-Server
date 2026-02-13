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

import { NextFunction, Request, Response } from "express";
import { Config } from "@spacebar/util";

export function CORS(req: Request, res: Response, next: NextFunction) {
    const { allowedOrigins } = Config.get().security;
    const requestOrigin = req.header("Origin");

    // If allowedOrigins is configured, validate the origin
    if (allowedOrigins && allowedOrigins.length > 0) {
        if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
            res.set("Access-Control-Allow-Origin", requestOrigin);
            res.set("Access-Control-Allow-Credentials", "true");
        }
        // If origin is not in the whitelist, don't set CORS headers (browser will block the request)
    } else {
        // Backwards-compatible: allow all origins
        res.set("Access-Control-Allow-Origin", requestOrigin ?? "*");
        res.set("Access-Control-Allow-Credentials", "true");
    }

    res.set("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers") || "*");
    res.set("Access-Control-Allow-Methods", req.header("Access-Control-Request-Method") || "*");
    res.set("Access-Control-Max-Age", "86400");

    // Restrictive Content-Security-Policy
    res.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' wss:; font-src 'self'; frame-ancestors 'none'",
    );

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    next();
}
