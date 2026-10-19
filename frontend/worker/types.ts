export interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }

  API_ORIGIN?: string
}
