import assert from "node:assert/strict"

import { randomBytes, randomUUID } from "node:crypto"

import { readdir, readFile } from "node:fs/promises"

import path from "node:path"
import { spawn } from "node:child_process"
import { once } from "node:events"
import net from "node:net"

import "dotenv/config"

import bcrypt from "bcryptjs"

import pg from "pg"

const sourceUrl = new URL(process.env.DATABASE_URL)

const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"])

assert.ok(
  process.env.NODE_ENV !== "production" &&
    sourceUrl.protocol === "postgresql:" &&
    localHosts.has(sourceUrl.hostname),

  "La simulation exige une DATABASE_URL PostgreSQL locale hors production.",
)

const ssl =
  process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false

const temporaryDatabase = `cc_isolation_test_${randomBytes(8).toString("hex")}`

const temporaryDatabaseIdentifier = `"${temporaryDatabase}"`

const maintenance = new pg.Client({
  connectionString: sourceUrl.href,

  ssl,

  connectionTimeoutMillis: 5000,
})

let databaseCreated = false

let apiProcess

let temporaryClient

async function findAvailablePort() {
  const server = net.createServer()

  server.listen(0, "127.0.0.1")

  await once(server, "listening")

  const address = server.address()

  assert.ok(address && typeof address !== "string")

  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })

  return address.port
}

async function waitForApi(baseUrl) {
  const deadline = Date.now() + 15_000

  while (Date.now() < deadline) {
    if (apiProcess.exitCode !== null) {
      throw new Error(
        `L’API de recette s’est arrêtée (${apiProcess.exitCode}).`,
      )
    }

    try {
      const response = await fetch(new URL("/api/health", baseUrl), {
        signal: AbortSignal.timeout(1000),
      })

      if (response.status === 200) {
        const health = await response.json()

        assert.equal(health.status, "ok")

        assert.equal(health.database, "connected")

        return
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }

  throw new Error("L’API temporaire n’est pas devenue disponible à temps.")
}

async function waitForApiExit(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (
    apiProcess.exitCode === null &&
    apiProcess.signalCode === null &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return apiProcess.exitCode !== null || apiProcess.signalCode !== null
}

async function request(baseUrl, endpoint, options = {}, cookie) {
  const headers = new Headers(options.headers)

  if (cookie) headers.set("Cookie", cookie)

  const response = await fetch(new URL(endpoint, baseUrl), {
    ...options,

    headers,

    signal: AbortSignal.timeout(5000),
  })

  let body

  try {
    body = response.status === 204 ? null : await response.json()
  } catch {
    throw new Error(
      `${options.method ?? "GET"} ${endpoint}: réponse JSON invalide.`,
    )
  }

  return { response, body }
}

async function login(baseUrl, email, password) {
  const { response, body } = await request(baseUrl, "/api/auth/login", {
    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ identifier: email, password, rememberMe: false }),
  })

  assert.equal(response.status, 200, `Échec de connexion pour ${email}.`)

  assert.equal(body.user.role, "ADMIN_ENTERPRISE")

  const cookieHeader = response.headers.get("set-cookie")

  const token = cookieHeader?.match(/(?:^|,\s*)cc_session=([^;,\s]+)/)?.[1]

  assert.ok(token, `Cookie de session absent pour ${email}.`)

  return { user: body.user, cookie: `cc_session=${token}` }
}

async function stopApi() {
  if (
    !apiProcess ||
    apiProcess.exitCode !== null ||
    apiProcess.signalCode !== null
  ) {
    return
  }

  apiProcess.kill("SIGTERM")

  if (!(await waitForApiExit(3000))) {
    apiProcess.kill("SIGKILL")
    assert.ok(
      await waitForApiExit(3000),
      "Impossible d’arrêter le serveur API temporaire.",
    )
  }
}

try {
  await maintenance.connect()

  await maintenance.query(`CREATE DATABASE ${temporaryDatabaseIdentifier}`)

  databaseCreated = true

  const temporaryUrl = new URL(sourceUrl.href)

  temporaryUrl.pathname = `/${temporaryDatabase}`

  temporaryClient = new pg.Client({
    connectionString: temporaryUrl.href,

    ssl,

    connectionTimeoutMillis: 5000,
  })

  await temporaryClient.connect()

  const migrationsDirectory = path.join(
    process.cwd(),

    "backend",

    "migrations",
  )

  const migrations = (await readdir(migrationsDirectory))

    .filter((file) => file.endsWith(".sql"))

    .sort()

  await temporaryClient.query(
    `CREATE TABLE schema_migrations (
       version text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  )

  for (const migration of migrations) {
    const sql = await readFile(
      path.join(migrationsDirectory, migration),
      "utf8",
    )

    await temporaryClient.query("BEGIN")

    try {
      await temporaryClient.query(sql)

      await temporaryClient.query(
        "INSERT INTO schema_migrations (version) VALUES ($1)",

        [migration],
      )

      await temporaryClient.query("COMMIT")
    } catch (error) {
      await temporaryClient.query("ROLLBACK")

      throw error
    }
  }

  const fixturePassword = randomBytes(24).toString("base64url")

  const passwordHash = await bcrypt.hash(fixturePassword, 4)

  const fixtureTenants = [
    {
      id: randomUUID(),

      name: "Isolation Test Alpha",

      email: `alpha-${randomUUID()}@example.invalid`,

      siteName: "Alpha test site",

      taskTitle: "Alpha private task",
    },

    {
      id: randomUUID(),

      name: "Isolation Test Beta",

      email: `beta-${randomUUID()}@example.invalid`,

      siteName: "Beta test site",

      taskTitle: "Beta private task",
    },
  ]

  const { roleAccess } = await import("../../dist-server/role-access.js")

  for (const fixture of fixtureTenants) {
    await temporaryClient.query(
      "INSERT INTO tenants (id, name, plan) VALUES ($1, $2, 'Plan PME')",

      [fixture.id, fixture.name],
    )

    await temporaryClient.query(
      `INSERT INTO tenant_subscriptions (tenant_id, plan_id, status)
       SELECT $1, id, 'Actif' FROM subscription_plans WHERE name = 'Plan PME'`,

      [fixture.id],
    )

    const adminId = randomUUID()

    const access = roleAccess.ADMIN_ENTERPRISE

    await temporaryClient.query(
      `INSERT INTO users (
         id, tenant_id, email, password_hash, full_name, initials, role,
         role_label, tenant_name, tenant_plan, sections, capabilities
       ) VALUES ($1, $2, $3, $4, $5, $6, 'ADMIN_ENTERPRISE', $7, $8, $9, $10, $11)`,

      [
        adminId,

        fixture.id,

        fixture.email,

        passwordHash,

        fixture.name,

        fixture.name.slice(0, 2).toUpperCase(),

        access.label,

        fixture.name,

        "Plan PME",

        JSON.stringify(access.sections),

        JSON.stringify(access.capabilities),
      ],
    )

    const siteId = randomUUID()

    await temporaryClient.query(
      `INSERT INTO sites (id, tenant_id, name, location)
       VALUES ($1, $2, $3, 'Recette locale')`,

      [siteId, fixture.id, fixture.siteName],
    )

    await temporaryClient.query(
      `INSERT INTO tasks (tenant_id, site_id, title, created_by)
       VALUES ($1, $2, $3, $4)`,

      [fixture.id, siteId, fixture.taskTitle, adminId],
    )
  }

  const port = await findAvailablePort()

  const baseUrl = `http://127.0.0.1:${port}`

  const testEnvironment = {
    ...process.env,

    NODE_ENV: "test",

    PORT: String(port),

    DATABASE_URL: temporaryUrl.href,

    DATABASE_SSL: process.env.DATABASE_SSL ?? "false",

    JWT_SECRET: randomBytes(64).toString("base64url"),
  }

  apiProcess = spawn(
    process.execPath,

    ["dist-server/index.js"],

    {
      cwd: process.cwd(),

      env: testEnvironment,

      stdio: "ignore",
    },
  )

  await waitForApi(baseUrl)

  const sessions = await Promise.all(
    fixtureTenants.map((fixture) =>
      login(baseUrl, fixture.email, fixturePassword),
    ),
  )

  assert.notEqual(
    sessions[0].user.tenantId,

    sessions[1].user.tenantId,

    "Les comptes de recette doivent appartenir à deux tenants différents.",
  )

  const siteResults = await Promise.all(
    sessions.map((session) =>
      request(baseUrl, "/api/sites", {}, session.cookie),
    ),
  )

  for (let index = 0; index < sessions.length; index += 1) {
    assert.equal(siteResults[index].response.status, 200)

    assert.deepEqual(
      siteResults[index].body.data.map((site) => site.name),

      [fixtureTenants[index].siteName],

      "La liste des chantiers doit être cloisonnée par tenant.",
    )
  }

  console.info("OK lecture : chaque entreprise ne voit que son chantier.")

  const taskResults = await Promise.all(
    sessions.map((session) =>
      request(baseUrl, "/api/tasks", {}, session.cookie),
    ),
  )

  for (let index = 0; index < sessions.length; index += 1) {
    assert.equal(taskResults[index].response.status, 200)

    assert.deepEqual(
      taskResults[index].body.data.map((task) => task.title),

      [fixtureTenants[index].taskTitle],

      "La liste des tâches doit être cloisonnée par tenant.",
    )
  }

  console.info("OK lecture : chaque entreprise ne voit que ses tâches.")

  for (let index = 0; index < sessions.length; index += 1) {
    const otherIndex = 1 - index

    const crossTenantCreate = await request(
      baseUrl,

      "/api/tasks",

      {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          siteId: siteResults[otherIndex].body.data[0].id,

          title: "Tentative écriture croisée",
        }),
      },

      sessions[index].cookie,
    )

    assert.equal(
      crossTenantCreate.response.status,

      404,

      "La création d’une tâche sur le chantier d’un autre tenant doit être refusée.",
    )

    const crossTenantUpdate = await request(
      baseUrl,

      `/api/tasks/${taskResults[otherIndex].body.data[0].id}/status`,

      {
        method: "PATCH",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ status: "Terminée" }),
      },

      sessions[index].cookie,
    )

    assert.equal(
      crossTenantUpdate.response.status,

      404,

      "La modification d’une tâche d’un autre tenant doit être refusée.",
    )
  }

  console.info("OK écriture : les tentatives inter-entreprises sont refusées.")

  console.info(
    `Simulation locale terminée avec succès; ${migrations.length} migrations appliquées à une base temporaire.`,
  )
} finally {
  let cleanupError
  try {
    await stopApi()
  } catch (error) {
    cleanupError = error
  }

  if (temporaryClient) {
    await temporaryClient.end().catch((error) => {
      console.error(
        "Échec de fermeture de la connexion de test :",
        error.message,
      )
      cleanupError ??= error
    })
  }

  if (databaseCreated) {
    try {
      await maintenance.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [temporaryDatabase],
      )
      await maintenance.query(`DROP DATABASE ${temporaryDatabaseIdentifier}`)
      console.info("Base PostgreSQL temporaire supprimée.")
    } catch (error) {
      cleanupError ??= error
    }
  }

  await maintenance.end().catch((error) => {
    cleanupError ??= error
  })
  if (cleanupError) throw cleanupError
}
