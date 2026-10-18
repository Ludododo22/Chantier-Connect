declare module "cloudflare:node" {
  import type { Server } from "node:http"

  export function httpServerHandler(
    server: Server,
  ): {
    fetch(request: Request): Response | Promise<Response>
  }
}
