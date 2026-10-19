import { httpServerHandler } from "cloudflare:node"

import { createServer } from "node:http"

import { setBackendRuntimeEnvironment } from "../backend/src/runtime-environment.js"

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

    const databaseUrl = env.DATABASE_URL
    const jwtSecret = env.JWT_SECRET
    const missingSecrets = [
      !databaseUrl && "DATABASE_URL",
      !jwtSecret && "JWT_SECRET",
    ].filter(Boolean)

    if (missingSecrets.length > 0) {
      console.error(`Secrets Worker manquants : ${missingSecrets.join(", ")}`)

      return Response.json(
        {
          status: "error",
          error: "Configuration API Cloudflare incomplète.",
          missing: missingSecrets,
        },
        { status: 503 },
      )
    }

    setBackendRuntimeEnvironment({
      DATABASE_URL: databaseUrl,
      DATABASE_SSL: "true",
      JWT_SECRET: jwtSecret,
      NODE_ENV: "production",
    })

    const handler = await getApiHandler()

    return handler.fetch(request)
  },
}
