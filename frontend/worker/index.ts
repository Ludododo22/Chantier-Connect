import type { Env } from "./types.js"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestUrl = new URL(request.url)
    const pathname = requestUrl.pathname

    if (pathname !== "/api" && !pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request)
    }

    if (!env.API_ORIGIN) {
      return Response.json(
        {
          status: "error",
          error: "L’URL du backend Node n’est pas configurée.",
        },
        { status: 503 },
      )
    }

    let backendOrigin: URL

    try {
      backendOrigin = new URL(env.API_ORIGIN)
    } catch {
      console.error("API_ORIGIN doit être une URL HTTP(S) valide.")

      return Response.json(
        { status: "error", error: "Configuration du backend invalide." },
        { status: 503 },
      )
    }

    if (
      backendOrigin.protocol !== "https:" ||
      backendOrigin.username ||
      backendOrigin.password ||
      backendOrigin.pathname !== "/" ||
      backendOrigin.search ||
      backendOrigin.hash
    ) {
      console.error("API_ORIGIN doit contenir uniquement l’origine du backend.")

      return Response.json(
        { status: "error", error: "Configuration du backend invalide." },
        { status: 503 },
      )
    }

    const backendUrl = new URL(
      `${requestUrl.pathname}${requestUrl.search}`,
      backendOrigin,
    )
    const headers = new Headers(request.headers)
    headers.delete("host")

    try {
      return await fetch(
        new Request(backendUrl, {
          method: request.method,
          headers,
          body:
            request.method === "GET" || request.method === "HEAD"
              ? undefined
              : request.body,
          redirect: "manual",
        }),
      )
    } catch (error) {
      console.error("Le backend Node est injoignable depuis Cloudflare :", error)

      return Response.json(
        { status: "error", error: "Le backend est temporairement indisponible." },
        { status: 502 },
      )
    }
  },
}
