import assert from "node:assert/strict"

import { createHash, randomBytes, randomUUID } from "node:crypto"

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

async function login(baseUrl, email, password, expectedRole = "ADMIN_ENTERPRISE") {
  const { response, body } = await request(baseUrl, "/api/auth/login", {
    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ identifier: email, password, rememberMe: false }),
  })

  assert.equal(response.status, 200, `Échec de connexion pour ${email}.`)

  assert.equal(body.user.role, expectedRole)

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

      phone: `+241${randomBytes(4).toString("hex")}`,

      siteName: "Alpha test site",

      taskTitle: "Alpha private task",
    },

    {
      id: randomUUID(),

      name: "Isolation Test Beta",

      email: `beta-${randomUUID()}@example.invalid`,

      phone: `+241${randomBytes(4).toString("hex")}`,

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
      `INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, renews_at)
       SELECT $1, id, 'Actif', CURRENT_DATE + 30
       FROM subscription_plans WHERE name = 'Plan PME'`,

      [fixture.id],
    )

    const adminId = randomUUID()

    const access = roleAccess.ADMIN_ENTERPRISE

    await temporaryClient.query(
      `INSERT INTO users (
         id, tenant_id, email, phone, password_hash, full_name, initials, role,
         role_label, tenant_name, tenant_plan, sections, capabilities
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ADMIN_ENTERPRISE', $8, $9, $10, $11, $12)`,

      [
        adminId,

        fixture.id,

        fixture.email,

        fixture.phone,

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

  const editorId = randomUUID()
  const editorEmail = `editor-${randomUUID()}@example.invalid`
  const editorAccess = roleAccess.EDITOR
  await temporaryClient.query(
    `INSERT INTO users (
       id, tenant_id, email, password_hash, full_name, initials, role,
       role_label, tenant_name, tenant_plan, sections, capabilities
     ) VALUES ($1, NULL, $2, $3, 'Editor isolation test', 'EI', 'EDITOR',
       $4, 'Chantier Connect', '', $5, $6)`,
    [
      editorId,
      editorEmail,
      passwordHash,
      editorAccess.label,
      JSON.stringify(editorAccess.sections),
      JSON.stringify(editorAccess.capabilities),
    ],
  )

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

      stdio: "inherit",
    },
  )

  await waitForApi(baseUrl)

  const sessions = await Promise.all(
    fixtureTenants.map((fixture) =>
      login(baseUrl, fixture.email, fixturePassword),
    ),
  )
  const editorSession = await login(
    baseUrl,
    editorEmail,
    fixturePassword,
    "EDITOR",
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

  const roleSiteId = siteResults[0].body.data[0].id
  const tenantRoles = [
    "CONDUCTEUR",
    "CHEF_CHANTIER",
    "COMPAGNON",
    "SOUS_TRAITANT",
    "COMPTABLE",
    "MAITRE_OUVRAGE",
  ]
  const roleAccounts = new Map()
  for (const role of tenantRoles) {
    const id = randomUUID()
    const email = `${role.toLowerCase()}-${randomUUID()}@example.invalid`
    const access = roleAccess[role]
    await temporaryClient.query(
      `INSERT INTO users (
         id, tenant_id, email, password_hash, full_name, initials, role,
         role_label, tenant_name, tenant_plan, assigned_site, assigned_site_id,
         sections, capabilities
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Plan PME', $10, $11, $12, $13)`,
      [
        id,
        fixtureTenants[0].id,
        email,
        passwordHash,
        `Compte ${role}`,
        role.slice(0, 2),
        role,
        access.label,
        fixtureTenants[0].name,
        role === "COMPTABLE" ? null : fixtureTenants[0].siteName,
        role === "COMPTABLE" ? null : roleSiteId,
        JSON.stringify(access.sections),
        JSON.stringify(access.capabilities),
      ],
    )
    roleAccounts.set(role, { id, email })
  }
  const roleSessions = new Map()
  for (const [role, account] of roleAccounts) {
    roleSessions.set(
      role,
      await login(baseUrl, account.email, fixturePassword, role),
    )
  }
  roleSessions.set("ADMIN_ENTERPRISE", sessions[0])
  assert.equal(
    roleSessions.get("CONDUCTEUR").user.sections.includes("Équipe"),
    true,
  )
  assert.equal(
    roleSessions.get("COMPTABLE").user.sections.includes("Trésorerie"),
    true,
  )
  assert.equal(
    roleSessions.get("MAITRE_OUVRAGE").user.sections.includes("Chantiers"),
    true,
  )
  assert.equal(
    roleSessions.get("ADMIN_ENTERPRISE").user.capabilities.includes("manage_finance"),
    false,
  )
  assert.equal(
    roleSessions.get("ADMIN_ENTERPRISE").user.capabilities.includes("read_finance"),
    true,
  )
  assert.equal(
    roleSessions.get("COMPTABLE").user.capabilities.includes("manage_finance"),
    true,
  )
  const contractorAttendance = await request(
    baseUrl,
    "/api/attendance",
    {},
    roleSessions.get("SOUS_TRAITANT").cookie,
  )
  assert.equal(contractorAttendance.response.status, 403)
  const clockIn = await request(
    baseUrl,
    "/api/attendance/clock-in",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
    roleSessions.get("CHEF_CHANTIER").cookie,
  )
  assert.equal(clockIn.response.status, 201)
  const attendanceId = clockIn.body.data.id
  const duplicateClockIn = await request(
    baseUrl,
    "/api/attendance/clock-in",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
    roleSessions.get("CHEF_CHANTIER").cookie,
  )
  assert.equal(duplicateClockIn.response.status, 409)
  const clockOut = await request(
    baseUrl,
    "/api/attendance/clock-out",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
    roleSessions.get("CHEF_CHANTIER").cookie,
  )
  assert.equal(clockOut.response.status, 200)
  const duplicateClockOut = await request(
    baseUrl,
    "/api/attendance/clock-out",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
    roleSessions.get("CHEF_CHANTIER").cookie,
  )
  assert.equal(duplicateClockOut.response.status, 404)
  const attendanceAudit = await temporaryClient.query(
    `SELECT action, target_type, payload_masked
     FROM audit_logs
     WHERE actor_id = $1 AND target_id = $2
     ORDER BY created_at`,
    [roleSessions.get("CHEF_CHANTIER").user.id, attendanceId],
  )
  assert.deepEqual(
    attendanceAudit.rows.map((entry) => entry.action),
    ["ATTENDANCE_CLOCKED_IN", "ATTENDANCE_CLOCKED_OUT"],
  )
  assert.ok(attendanceAudit.rows.every((entry) => entry.target_type === "attendance"))
  assert.ok(
    attendanceAudit.rows.every(
      (entry) =>
        !("latitude" in entry.payload_masked) &&
        !("longitude" in entry.payload_masked),
    ),
    "L’audit du pointage ne doit pas conserver les coordonnées GPS.",
  )
  console.info("OK rôles : les comptes reçoivent leurs sections et permissions serveur définies.")

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

  const roleTask = await request(
    baseUrl,
    "/api/tasks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: roleSiteId,
        title: "Tâche réservée au compagnon",
        assignedTo: roleAccounts.get("COMPAGNON").id,
      }),
    },
    sessions[0].cookie,
  )
  assert.equal(roleTask.response.status, 201)
  const companionTasks = await request(
    baseUrl,
    "/api/tasks",
    {},
    roleSessions.get("COMPAGNON").cookie,
  )
  assert.deepEqual(
    companionTasks.body.data.map((task) => task.id),
    [roleTask.body.data.id],
  )
  for (const status of ["Bloquée", "En cours", "Terminée"]) {
    const updateAssignedTask = await request(
      baseUrl,
      `/api/tasks/${roleTask.body.data.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
      roleSessions.get("COMPAGNON").cookie,
    )
    assert.equal(updateAssignedTask.response.status, 200)
    assert.equal(updateAssignedTask.body.data.status, status)
  }
  const leadTasks = await request(
    baseUrl,
    "/api/tasks",
    {},
    roleSessions.get("CONDUCTEUR").cookie,
  )
  assert.ok(leadTasks.body.data.some((task) => task.id === roleTask.body.data.id))
  const unrelatedTaskUpdate = await request(
    baseUrl,
    `/api/tasks/${taskResults[0].body.data[0].id}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Terminée" }),
    },
    roleSessions.get("COMPAGNON").cookie,
  )
  assert.equal(unrelatedTaskUpdate.response.status, 404)

  const conductorSites = await request(
    baseUrl,
    "/api/sites",
    {},
    roleSessions.get("CONDUCTEUR").cookie,
  )
  assert.deepEqual(
    conductorSites.body.data.map((site) => site.id),
    [roleSiteId],
  )
  const conductorCannotCreateSite = await request(
    baseUrl,
    "/api/sites",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Chantier non autorisé", location: "Test" }),
    },
    roleSessions.get("CONDUCTEUR").cookie,
  )
  assert.equal(conductorCannotCreateSite.response.status, 403)
  const conductorTeam = await request(
    baseUrl,
    "/api/team",
    {},
    roleSessions.get("CONDUCTEUR").cookie,
  )
  assert.equal(conductorTeam.response.status, 200)
  const conductorCannotManageTeam = await request(
    baseUrl,
    "/api/team",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Création refusée",
        email: `forbidden-${randomUUID()}@example.invalid`,
        role: "COMPAGNON",
        assignedSiteId: roleSiteId,
        temporaryPassword: randomBytes(18).toString("base64url"),
      }),
    },
    roleSessions.get("CONDUCTEUR").cookie,
  )
  assert.equal(conductorCannotManageTeam.response.status, 403)

  const attendance = await request(
    baseUrl,
    "/api/attendance/clock-in",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    roleSessions.get("COMPAGNON").cookie,
  )
  assert.equal(attendance.response.status, 201)
  const subcontractorCannotClockIn = await request(
    baseUrl,
    "/api/attendance/clock-in",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    roleSessions.get("SOUS_TRAITANT").cookie,
  )
  assert.equal(subcontractorCannotClockIn.response.status, 403)

  const draftReport = await request(
    baseUrl,
    "/api/reports",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: roleSiteId,
        workDone: "Rapport de test par le conducteur.",
        crewCount: 2,
      }),
    },
    roleSessions.get("CHEF_CHANTIER").cookie,
  )
  assert.equal(draftReport.response.status, 201)
  const conductorCannotCreateReport = await request(
    baseUrl,
    "/api/reports",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: roleSiteId,
        workDone: "Création non autorisée pour le conducteur.",
        crewCount: 1,
      }),
    },
    roleSessions.get("CONDUCTEUR").cookie,
  )
  assert.equal(conductorCannotCreateReport.response.status, 403)
  const moDraftReports = await request(
    baseUrl,
    "/api/reports",
    {},
    roleSessions.get("MAITRE_OUVRAGE").cookie,
  )
  assert.equal(moDraftReports.response.status, 200)
  assert.equal(moDraftReports.body.data.some(
    (report) => report.id === draftReport.body.data.id,
  ), false)
  const validateReport = await request(
    baseUrl,
    `/api/reports/${draftReport.body.data.id}/validate`,
    { method: "POST" },
    roleSessions.get("CONDUCTEUR").cookie,
  )
  assert.equal(validateReport.response.status, 200)
  const secondDraftReport = await request(
    baseUrl,
    "/api/reports",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: roleSiteId,
        workDone: "Second rapport en attente.",
        crewCount: 1,
      }),
    },
    roleSessions.get("CHEF_CHANTIER").cookie,
  )
  assert.equal(secondDraftReport.response.status, 201)
  const chefCannotValidateReport = await request(
    baseUrl,
    `/api/reports/${secondDraftReport.body.data.id}/validate`,
    { method: "POST" },
    roleSessions.get("CHEF_CHANTIER").cookie,
  )
  assert.equal(chefCannotValidateReport.response.status, 403)
  const moValidatedReports = await request(
    baseUrl,
    "/api/reports",
    {},
    roleSessions.get("MAITRE_OUVRAGE").cookie,
  )
  assert.ok(moValidatedReports.body.data.some(
    (report) => report.id === draftReport.body.data.id,
  ))
  const moCannotCreateReport = await request(
    baseUrl,
    "/api/reports",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: roleSiteId,
        workDone: "Rapport non autorisé.",
        crewCount: 1,
      }),
    },
    roleSessions.get("MAITRE_OUVRAGE").cookie,
  )
  assert.equal(moCannotCreateReport.response.status, 403)

  const accountantFinance = await request(
    baseUrl,
    "/api/finance",
    {},
    roleSessions.get("COMPTABLE").cookie,
  )
  assert.equal(accountantFinance.response.status, 200)
  const conductorFinance = await request(
    baseUrl,
    "/api/finance",
    {},
    roleSessions.get("CONDUCTEUR").cookie,
  )
  assert.equal(conductorFinance.response.status, 403)
  const adminFinance = await request(
    baseUrl,
    "/api/finance",
    {},
    roleSessions.get("ADMIN_ENTERPRISE").cookie,
  )
  assert.equal(adminFinance.response.status, 200)
  const adminFinanceMutation = await request(
    baseUrl,
    "/api/finance",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryType: "depense",
        siteId: roleSiteId,
        category: "Test",
        description: "Opération refusée à l’administrateur",
        amountFcfa: 1000,
      }),
    },
    roleSessions.get("ADMIN_ENTERPRISE").cookie,
  )
  assert.equal(adminFinanceMutation.response.status, 403)
  const accountantFinanceMutation = await request(
    baseUrl,
    "/api/finance",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryType: "depense",
        siteId: roleSiteId,
        category: "Fournitures",
        description: "Achat de fournitures de recette",
        amountFcfa: 1000,
      }),
    },
    roleSessions.get("COMPTABLE").cookie,
  )
  assert.equal(accountantFinanceMutation.response.status, 201)
  const financeEntryId = accountantFinanceMutation.body.data.id
  const accountantRealizeFinance = await request(
    baseUrl,
    `/api/finance/${financeEntryId}/realize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "réalisé" }),
    },
    roleSessions.get("COMPTABLE").cookie,
  )
  assert.equal(accountantRealizeFinance.response.status, 200)
  const adminCannotRealizeFinance = await request(
    baseUrl,
    `/api/finance/${financeEntryId}/realize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "réalisé" }),
    },
    roleSessions.get("ADMIN_ENTERPRISE").cookie,
  )
  assert.equal(adminCannotRealizeFinance.response.status, 403)
  const adminPaymentDossiers = await request(
    baseUrl,
    "/api/payments",
    {},
    roleSessions.get("ADMIN_ENTERPRISE").cookie,
  )
  assert.equal(adminPaymentDossiers.response.status, 200)
  const adminPaymentMutation = await request(
    baseUrl,
    "/api/payments",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: roleSiteId,
        subject: "Dossier refusé",
        amountFcfa: 1000,
      }),
    },
    roleSessions.get("ADMIN_ENTERPRISE").cookie,
  )
  assert.equal(adminPaymentMutation.response.status, 403)
  const accountantPaymentDossier = await request(
    baseUrl,
    "/api/payments",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: roleSiteId,
        subject: "Situation de travaux de recette",
        amountFcfa: 2500,
      }),
    },
    roleSessions.get("COMPTABLE").cookie,
  )
  assert.equal(accountantPaymentDossier.response.status, 201)
  const paymentDossierId = accountantPaymentDossier.body.data.id
  for (const status of ["Prêt à transmettre", "En instruction", "Payé"]) {
    const statusUpdate = await request(
      baseUrl,
      `/api/payments/${paymentDossierId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
      roleSessions.get("COMPTABLE").cookie,
    )
    assert.equal(statusUpdate.response.status, 200)
  }
  const financeAudit = await temporaryClient.query(
    `SELECT action, target_type, target_id, payload_masked
     FROM audit_logs
     WHERE actor_id = $1 AND target_id = ANY($2::text[])
     ORDER BY created_at`,
    [
      roleSessions.get("COMPTABLE").user.id,
      [financeEntryId, paymentDossierId],
    ],
  )
  assert.deepEqual(
    financeAudit.rows.map((entry) => entry.action),
    [
      "FINANCE_ENTRY_CREATED",
      "FINANCE_ENTRY_REALIZED",
      "PAYMENT_DOSSIER_CREATED",
      "PAYMENT_DOSSIER_STATUS_CHANGED",
      "PAYMENT_DOSSIER_STATUS_CHANGED",
      "PAYMENT_DOSSIER_STATUS_CHANGED",
    ],
    "Chaque création et transition comptable doit être journalisée.",
  )
  assert.ok(
    financeAudit.rows.every((entry) =>
      ["finance_entry", "payment_dossier"].includes(entry.target_type),
    ),
  )
  console.info("OK permissions rôles : responsabilités chantier/rapport distinctes et lecture/écriture financière séparées.")

  const activity = await request(
    baseUrl,
    "/api/activity/recent",
    {},
    sessions[0].cookie,
  )
  assert.equal(activity.response.status, 200)
  assert.ok(
    activity.body.data.some(
      (entry) => entry.title === fixtureTenants[0].taskTitle,
    ),
    "L’activité récente doit inclure les données réelles de l’acteur.",
  )
  console.info("OK activité : les événements réels de l’acteur sont exposés.")

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

  const filteredUsers = await request(
    baseUrl,
    `/api/platform/users?page=1&limit=10&role=ADMIN_ENTERPRISE&tenantId=${fixtureTenants[0].id}`,
    {},
    editorSession.cookie,
  )
  assert.equal(filteredUsers.response.status, 200)
  assert.equal(filteredUsers.body.total, 1)
  assert.equal(filteredUsers.body.data.length, 1)
  assert.equal(filteredUsers.body.data[0].tenantId, fixtureTenants[0].id)
  assert.equal(filteredUsers.body.data[0].role, "ADMIN_ENTERPRISE")
  assert.equal("email" in filteredUsers.body.data[0], false)
  assert.equal("phone" in filteredUsers.body.data[0], false)
  assert.ok(filteredUsers.body.data[0].emailMasked.includes("•••@"))
  assert.ok(filteredUsers.body.data[0].phoneMasked.includes("•"))

  const directUserRead = await request(
    baseUrl,
    `/api/platform/users/${filteredUsers.body.data[0].id}`,
    {},
    editorSession.cookie,
  )
  assert.equal(directUserRead.response.status, 403)

  const unauthorizedPlatformRead = await request(
    baseUrl,
    "/api/platform/users",
    {},
    sessions[0].cookie,
  )
  assert.equal(unauthorizedPlatformRead.response.status, 403)
  console.info("OK utilisateurs éditeur : filtres et masquage des coordonnées.")

  const supportWithoutConsent = await request(
    baseUrl,
    `/api/platform/users/${filteredUsers.body.data[0].id}/support-access`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        justification: "Diagnostic demandé par le client.",
      }),
    },
    editorSession.cookie,
  )
  assert.equal(supportWithoutConsent.response.status, 409)

  const supportEmergencyAccess = await request(
    baseUrl,
    `/api/platform/users/${filteredUsers.body.data[0].id}/support-access`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        justification: "Compte bloqué, résolution urgente demandée.",
        emergencyOverride: true,
      }),
    },
    editorSession.cookie,
  )
  assert.equal(supportEmergencyAccess.response.status, 200)
  assert.equal(supportEmergencyAccess.body.data.consented, false)
  const supportAudit = await request(
    baseUrl,
    `/api/platform/audit-logs?tenantId=${fixtureTenants[0].id}&action=SUPPORT_ACCESS_EMERGENCY_OVERRIDE`,
    {},
    editorSession.cookie,
  )
  assert.equal(supportAudit.response.status, 200)
  assert.ok(supportAudit.body.data.length > 0)
  console.info("OK support : justification et dérogation d’urgence auditées.")

  const profileUpdate = await request(
    baseUrl,
    `/api/platform/users/${filteredUsers.body.data[0].id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "Admin Alpha mis à jour" }),
    },
    editorSession.cookie,
  )
  assert.equal(profileUpdate.response.status, 200)
  assert.equal("email" in profileUpdate.body.data, false)
  const profileAudit = await request(
    baseUrl,
    `/api/platform/audit-logs?tenantId=${fixtureTenants[0].id}&action=USER_PROFILE_UPDATED`,
    {},
    editorSession.cookie,
  )
  assert.equal(profileAudit.response.status, 200)
  assert.ok(profileAudit.body.data.some(
    (entry) => entry.targetId === filteredUsers.body.data[0].id,
  ))
  console.info("OK profil : modification transactionnelle et audit rattaché au tenant.")

  const blockedUserId = sessions[1].user.id
  const blockUser = await request(
    baseUrl,
    `/api/platform/users/${blockedUserId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    },
    editorSession.cookie,
  )
  assert.equal(blockUser.response.status, 200)
  const blockedSession = await request(baseUrl, "/api/auth/me", {}, sessions[1].cookie)
  assert.equal(blockedSession.response.status, 401)
  const unblockUser = await request(
    baseUrl,
    `/api/platform/users/${blockedUserId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    },
    editorSession.cookie,
  )
  assert.equal(unblockUser.response.status, 200)
  sessions[1] = await login(baseUrl, fixtureTenants[1].email, fixturePassword)
  const userStatusAudit = await request(
    baseUrl,
    `/api/platform/audit-logs?tenantId=${fixtureTenants[1].id}&action=USER_BLOCKED`,
    {},
    editorSession.cookie,
  )
  assert.equal(userStatusAudit.response.status, 200)
  assert.ok(userStatusAudit.body.data.some((entry) => entry.targetId === blockedUserId))
  console.info("OK comptes : blocage, révocation de session, réactivation et audit.")

  const plan = await temporaryClient.query(
    "SELECT id, name, monthly_price_fcfa, max_sites FROM subscription_plans WHERE active ORDER BY name LIMIT 1",
  )
  assert.ok(plan.rowCount)
  const partialPlanUpdate = await request(
    baseUrl,
    `/api/platform/plans/${plan.rows[0].id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxUsers: 777 }),
    },
    editorSession.cookie,
  )
  assert.equal(partialPlanUpdate.response.status, 200)
  assert.equal(partialPlanUpdate.body.data.name, plan.rows[0].name)
  assert.equal(
    Number(partialPlanUpdate.body.data.monthlyPriceFcfa),
    Number(plan.rows[0].monthly_price_fcfa),
  )
  assert.equal(partialPlanUpdate.body.data.maxSites, plan.rows[0].max_sites)
  console.info("OK plan : un PATCH partiel préserve les champs absents.")

  const registrationRequestId = randomUUID()
  const registrationPhone = `+241${randomBytes(4).toString("hex")}`
  const convertedEmail = `converted-${randomUUID()}@example.invalid`
  const clientTemporaryPassword = randomBytes(18).toString("base64url")
  await temporaryClient.query(
    `INSERT INTO registration_requests (
       id, company_name, admin_full_name, admin_email, phone, message, consent_at
     ) VALUES ($1, 'Entreprise conversion test', 'Admin conversion',
       $2, $3, 'Demande de création utilisée pour la recette.', now())`,
    [registrationRequestId, convertedEmail, registrationPhone],
  )
  const conversion = await request(
    baseUrl,
    "/api/platform/tenants",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Entreprise conversion test",
        adminFullName: "Admin conversion",
        adminEmail: convertedEmail,
        phone: registrationPhone,
        temporaryPassword: clientTemporaryPassword,
        planId: plan.rows[0].id,
        registrationRequestId,
      }),
    },
    editorSession.cookie,
  )
  assert.equal(conversion.response.status, 201)
  const linkedRequest = await temporaryClient.query(
    "SELECT status, tenant_id FROM registration_requests WHERE id = $1",
    [registrationRequestId],
  )
  assert.equal(linkedRequest.rows[0].status, "Entreprise créée")
  assert.equal(linkedRequest.rows[0].tenant_id, conversion.body.data.id)
  const convertedAdmin = await temporaryClient.query(
    "SELECT phone FROM users WHERE tenant_id = $1 AND role = 'ADMIN_ENTERPRISE'",
    [conversion.body.data.id],
  )
  assert.equal(convertedAdmin.rows[0].phone, registrationPhone)
  const clientAdminSession = await login(
    baseUrl,
    convertedEmail,
    clientTemporaryPassword,
  )
  assert.equal(clientAdminSession.user.tenantId, conversion.body.data.id)
  const initialCompanySettings = await request(
    baseUrl,
    "/api/company/settings",
    {},
    clientAdminSession.cookie,
  )
  assert.equal(initialCompanySettings.response.status, 200)
  assert.equal(initialCompanySettings.body.data.legalName, "Entreprise conversion test")
  const updatedCompanySettings = await request(
    baseUrl,
    "/api/company/settings",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalName: "Entreprise conversion modifiée",
        taxId: "",
        email: convertedEmail,
        phone: registrationPhone,
        address: "Adresse de recette",
        city: "Libreville",
        country: "Gabon",
        language: "fr",
        currency: "XAF",
        preferences: {},
      }),
    },
    clientAdminSession.cookie,
  )
  assert.equal(updatedCompanySettings.response.status, 200)
  assert.equal(updatedCompanySettings.body.data.legalName, "Entreprise conversion modifiée")

  const clientSite = await request(
    baseUrl,
    "/api/sites",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Chantier client recette",
        location: "Libreville",
      }),
    },
    clientAdminSession.cookie,
  )
  assert.equal(clientSite.response.status, 201)
  const duplicateNameSite = await request(
    baseUrl,
    "/api/sites",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: clientSite.body.data.name,
        location: "Deuxième localisation de recette",
      }),
    },
    clientAdminSession.cookie,
  )
  assert.equal(duplicateNameSite.response.status, 201)
  const clientMemberEmail = `member-${randomUUID()}@example.invalid`
  const clientMemberPassword = randomBytes(18).toString("base64url")
  const clientMember = await request(
    baseUrl,
    "/api/team",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Membre chantier recette",
        email: clientMemberEmail,
        role: "COMPAGNON",
        assignedSiteId: clientSite.body.data.id,
        temporaryPassword: clientMemberPassword,
      }),
    },
    clientAdminSession.cookie,
  )
  assert.equal(clientMember.response.status, 201)
  assert.equal(clientMember.body.data.role, "COMPAGNON")
  assert.equal(clientMember.body.data.assignedSiteId, clientSite.body.data.id)
  assert.notEqual(
    clientMember.body.data.assignedSiteId,
    duplicateNameSite.body.data.id,
  )
  const crossTenantAssignment = await request(
    baseUrl,
    "/api/team",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Affectation inter-entreprises refusée",
        email: `cross-member-${randomUUID()}@example.invalid`,
        role: "COMPAGNON",
        assignedSiteId: siteResults[1].body.data[0].id,
        temporaryPassword: randomBytes(18).toString("base64url"),
      }),
    },
    clientAdminSession.cookie,
  )
  assert.equal(crossTenantAssignment.response.status, 400)
  const clientTeam = await request(
    baseUrl,
    "/api/team",
    {},
    clientAdminSession.cookie,
  )
  assert.equal(clientTeam.response.status, 200)
  assert.ok(clientTeam.body.data.some(
    (member) => member.id === clientMember.body.data.id &&
      member.assignedSiteId === clientSite.body.data.id,
  ))
  const clientSiteDetail = await request(
    baseUrl,
    `/api/sites/${clientSite.body.data.id}`,
    {},
    clientAdminSession.cookie,
  )
  assert.equal(clientSiteDetail.response.status, 200)
  assert.ok(clientSiteDetail.body.data.assignedTeam.some(
    (member) => member.id === clientMember.body.data.id,
  ))
  const clientMemberSession = await login(
    baseUrl,
    clientMemberEmail,
    clientMemberPassword,
    "COMPAGNON",
  )

  const activationWithoutEndDate = await request(
    baseUrl,
    `/api/platform/tenants/${conversion.body.data.id}/subscription`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.rows[0].id,
        status: "Actif",
        renewsAt: null,
      }),
    },
    editorSession.cookie,
  )
  assert.equal(activationWithoutEndDate.response.status, 400)

  const subscriptionDates = await temporaryClient.query(
    `SELECT CURRENT_DATE::text AS today,
            (CURRENT_DATE + 30)::text AS future,
            (CURRENT_DATE - 1)::text AS past`,
  )
  const activationWithExpiredDate = await request(
    baseUrl,
    `/api/platform/tenants/${conversion.body.data.id}/subscription`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.rows[0].id,
        status: "Actif",
        renewsAt: subscriptionDates.rows[0].past,
      }),
    },
    editorSession.cookie,
  )
  assert.equal(activationWithExpiredDate.response.status, 400)
  await temporaryClient.query(
    `UPDATE tenant_subscriptions
     SET status = 'Actif', renews_at = $2::date
     WHERE tenant_id = $1`,
    [conversion.body.data.id, subscriptionDates.rows[0].past],
  )
  await temporaryClient.query(
    "UPDATE tenants SET status = 'Actif' WHERE id = $1",
    [conversion.body.data.id],
  )
  for (const session of [clientAdminSession, clientMemberSession]) {
    const expiredSession = await request(
      baseUrl,
      "/api/auth/me",
      {},
      session.cookie,
    )
    assert.equal(expiredSession.response.status, 401)
    const blockedWorkspace = await request(
      baseUrl,
      "/api/sites",
      {},
      session.cookie,
    )
    assert.equal(blockedWorkspace.response.status, 401)
  }
  const expiredLogin = await request(baseUrl, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: convertedEmail,
      password: clientTemporaryPassword,
      rememberMe: false,
    }),
  })
  assert.equal(expiredLogin.response.status, 401)

  const cancelSubscription = await request(
    baseUrl,
    `/api/platform/tenants/${conversion.body.data.id}/subscription`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.rows[0].id,
        status: "Résilié",
        renewsAt: null,
      }),
    },
    editorSession.cookie,
  )
  assert.equal(cancelSubscription.response.status, 200)
  const reactivateSubscription = await request(
    baseUrl,
    `/api/platform/tenants/${conversion.body.data.id}/subscription`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planId: plan.rows[0].id,
        status: "Actif",
        renewsAt: subscriptionDates.rows[0].future,
      }),
    },
    editorSession.cookie,
  )
  assert.equal(reactivateSubscription.response.status, 200)
  const reactivatedSubscriptionDate = await temporaryClient.query(
    "SELECT renews_at::text AS renews_at FROM tenant_subscriptions WHERE tenant_id = $1",
    [conversion.body.data.id],
  )
  assert.equal(
    reactivatedSubscriptionDate.rows[0].renews_at,
    subscriptionDates.rows[0].future,
  )
  for (const session of [clientAdminSession, clientMemberSession]) {
    const restoredWorkspace = await request(
      baseUrl,
      "/api/sites",
      {},
      session.cookie,
    )
    assert.equal(restoredWorkspace.response.status, 200)
  }
  console.info("OK abonnement : échéance obligatoire, blocage après expiration pour l’admin et l’équipe, résiliation immédiate et réactivation Éditeur.")

  const tenantCreationAudit = await request(
    baseUrl,
    `/api/platform/audit-logs?tenantId=${conversion.body.data.id}&action=TENANT_CREATED`,
    {},
    editorSession.cookie,
  )
  assert.equal(tenantCreationAudit.response.status, 200)
  assert.equal(tenantCreationAudit.body.data.length, 1)
  assert.equal(
    JSON.stringify(tenantCreationAudit.body.data[0].payloadMasked).includes(
      clientTemporaryPassword,
    ),
    false,
  )
  assert.equal(
    JSON.stringify(tenantCreationAudit.body.data[0].payloadMasked).includes(
      clientMemberPassword,
    ),
    false,
  )
  const repeatedConversion = await request(
    baseUrl,
    "/api/platform/tenants",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Entreprise conversion test",
        adminFullName: "Admin conversion",
        adminEmail: convertedEmail,
        phone: registrationPhone,
        temporaryPassword: randomBytes(18).toString("base64url"),
        planId: plan.rows[0].id,
        registrationRequestId,
      }),
    },
    editorSession.cookie,
  )
  assert.equal(repeatedConversion.response.status, 409)
  console.info("OK entreprise cliente : paramètres initiaux et modifiables, chantier créé, équipe créée/affectée et secret absent de l’audit.")
  console.info("OK conversion : mot de passe Éditeur utilisé, téléphone conservé et répétition refusée.")

  const resetToken = randomBytes(32).toString("base64url")
  const resetTokenHash = createHash("sha256").update(resetToken).digest("hex")
  await temporaryClient.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '30 minutes')`,
    [sessions[1].user.id, resetTokenHash],
  )
  const replacementPassword = randomBytes(18).toString("base64url")
  const passwordReset = await request(baseUrl, "/api/auth/password-reset/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, newPassword: replacementPassword }),
  })
  assert.equal(passwordReset.response.status, 204)
  const revokedSession = await request(baseUrl, "/api/auth/me", {}, sessions[1].cookie)
  assert.equal(revokedSession.response.status, 401)
  const replayedReset = await request(baseUrl, "/api/auth/password-reset/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: resetToken, newPassword: replacementPassword }),
  })
  assert.equal(replayedReset.response.status, 400)
  const replacementSession = await login(
    baseUrl,
    fixtureTenants[1].email,
    replacementPassword,
  )
  assert.equal(replacementSession.user.id, sessions[1].user.id)
  console.info("OK reset : token à usage unique et révocation des sessions précédentes.")

  const site = siteResults[0].body.data[0]
  const archivedSite = await request(
    baseUrl,
    `/api/sites/${site.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: site.name,
        location: site.location,
        status: "Archivé",
        progress: site.progress,
        budgetFcfa: Number(site.budgetFcfa ?? 0),
        startDate: site.startDate,
        endDate: site.endDate,
      }),
    },
    sessions[0].cookie,
  )
  assert.equal(archivedSite.response.status, 200)
  assert.equal(archivedSite.body.data.status, "Archivé")
  const preservedTask = await temporaryClient.query(
    "SELECT id FROM tasks WHERE site_id = $1",
    [site.id],
  )
  assert.ok(preservedTask.rowCount >= 1)
  console.info("OK chantier : archivage sans suppression de l’historique.")

  await stopApi()
  await temporaryClient.query("UPDATE tenants SET status = 'Archivé' WHERE id = $1", [
    fixtureTenants[0].id,
  ])
  const rollbackSql = await readFile(
    path.join(
      migrationsDirectory,
      "rollback",
      "010_platform_administration.sql",
    ),
    "utf8",
  )
  await temporaryClient.query(rollbackSql)
  const rollbackState = await temporaryClient.query(
    `SELECT t.status AS tenant_status, s.status AS site_status,
            to_regclass('public.audit_logs') AS audit_table,
            to_regclass('public.password_reset_tokens') AS reset_table,
            EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'users'
                AND column_name = 'session_version'
            ) AS has_session_version
     FROM tenants t JOIN sites s ON s.tenant_id = t.id
     WHERE t.id = $1 AND s.id = $2`,
    [fixtureTenants[0].id, site.id],
  )
  assert.equal(rollbackState.rows[0].tenant_status, "Suspendu")
  assert.equal(rollbackState.rows[0].site_status, "Terminé")
  assert.equal(rollbackState.rows[0].audit_table, null)
  assert.equal(rollbackState.rows[0].reset_table, null)
  assert.equal(rollbackState.rows[0].has_session_version, false)
  console.info("OK migration : retour arrière structurel et conversion des statuts archivés.")

  console.info(
    `Simulation locale terminée avec succès; ${migrations.length} migrations appliquées puis la migration 010 annulée sur une base temporaire.`,
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
