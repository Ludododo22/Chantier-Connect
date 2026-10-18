import { httpServerHandler } from "cloudflare:node"

import { createServer } from "node:http"

import { env as processEnv } from "node:process"

import type { Env } from "./types.js"

let apiHandlerPromise: Promise<ReturnType<typeof httpServerHandler>> | undefined

async function getApiHandler() {
  apiHandlerPromise ??= (async () => {
    const { default: app } = await import("../backend/src/app.js")

    return httpServerHandler(createServer(app))
  })()

  return apiHandlerPromise
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname

    if (pathname !== "/api" && !pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request)
    }

    processEnv.DATABASE_URL = env.DATABASE_URL

    processEnv.DATABASE_SSL = "true"

    processEnv.JWT_SECRET = env.JWT_SECRET

    processEnv.NODE_ENV = "production"

    const handler = await getApiHandler()

    return handler.fetch(request)
  },
}
