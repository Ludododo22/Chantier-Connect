import express, { type ErrorRequestHandler } from "express"

import helmet from "helmet"

import { ZodError } from "zod"

import { config } from "./config.js"

import { pool } from "./db.js"

import authRoutes from "./routes/auth.js"

import mobilePaymentsRoutes from "./routes/mobile-payments.js"

import paymentsRoutes from "./routes/payments.js"

import platformRoutes from "./routes/platform.js"

import workRoutes from "./routes/work.js"

const app = express()

if (config.NODE_ENV === "production") app.set("trust proxy", 1)

app.disable("x-powered-by")

app.use(helmet())

app.use(express.json({ limit: "4mb" }))

app.get("/api/health", async (_request, response) => {
  try {
    await pool.query("SELECT 1")

    response.json({ status: "ok", database: "connected" })
  } catch (error) {
    console.error("La vérification PostgreSQL a échoué :", error)

    response.status(503).json({ status: "error", database: "unavailable" })
  }
})

app.use("/api/auth", authRoutes)

app.use("/api/mobile-payments", mobilePaymentsRoutes)

app.use("/api/platform", platformRoutes)

app.use("/api/payments", paymentsRoutes)

app.use("/api", workRoutes)

app.use((_request, response) => {
  response.status(404).json({ error: "Route API introuvable." })
})

const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Données invalides.",

      details: error.flatten().fieldErrors,
    })

    return
  }

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    response.status(400).json({ error: "Corps JSON invalide." })

    return
  }

  console.error("Erreur API non gérée :", error)

  response.status(500).json({ error: "Une erreur interne est survenue." })
}

app.use(errorHandler)

const server = app.listen(config.PORT, "0.0.0.0", () => {
  console.info(
    `API Chantier Connect disponible sur http://127.0.0.1:${config.PORT}`,
  )
})

async function shutdown(signal: string) {
  console.info(`Arrêt de l'API (${signal})...`)

  server.close(async (error) => {
    if (error) {
      console.error("Erreur lors de l'arrêt du serveur HTTP :", error)

      process.exitCode = 1
    }

    await pool.end()

    process.exit()
  })
}

process.once("SIGINT", () => void shutdown("SIGINT"))

process.once("SIGTERM", () => void shutdown("SIGTERM"))
