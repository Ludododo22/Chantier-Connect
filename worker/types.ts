export interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>
  }

  DATABASE_URL?: string

  JWT_SECRET?: string
}
