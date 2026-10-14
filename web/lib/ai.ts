/**
 * ai.ts: the server-only gate for the AI layer.
 *
 * App code imports this file. Scripts (ai-ping, ai-record) import ai-core.ts
 * directly because server-only throws outside Next.
 */

import "server-only";

export * from "./ai-core";
