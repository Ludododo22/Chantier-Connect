import assert from "node:assert/strict"

import { spawnSync } from "node:child_process"

const configModule = new URL("../../dist-server/config.js", import.meta.url)
  .href
const runtimeEnvironmentModule = new URL(
  "../../dist-server/runtime-environment.js",
  import.meta.url,
).href

const importConfig = `import(${JSON.stringify(configModule)})`

const databaseUrl = "postgresql://preflight:preflight@db.invalid:5432/preflight"

function loadProductionConfig({ databaseSsl, jwtSecret }) {
  return spawnSync(
    process.execPath,

    ["--input-type=module", "--eval", importConfig],

    {
      cwd: process.cwd(),

      encoding: "utf8",

      env: {
        ...process.env,

        NODE_ENV: "production",

        DATABASE_URL: databaseUrl,

        DATABASE_SSL: databaseSsl,

        JWT_SECRET: jwtSecret,
      },
    },
  )
}

function loadProductionConfigFromRuntimeEnvironment({
  databaseUrl,
  jwtSecret,
}) {
  const setupRuntimeEnvironment = `
    const { setBackendRuntimeEnvironment } = await import(${JSON.stringify(runtimeEnvironmentModule)});
    setBackendRuntimeEnvironment({
      DATABASE_URL: ${JSON.stringify(databaseUrl)},
      DATABASE_SSL: "true",
      JWT_SECRET: ${JSON.stringify(jwtSecret)},
      NODE_ENV: "production",
    });
    await import(${JSON.stringify(configModule)});
  `

  return spawnSync(
    process.execPath,

    ["--input-type=module", "--eval", setupRuntimeEnvironment],

    {
      cwd: process.cwd(),

      encoding: "utf8",

      env: {
        ...process.env,

        NODE_ENV: "",

        DATABASE_URL: "",

        DATABASE_SSL: "",

        JWT_SECRET: "",
      },
    },
  )
}

const secureSecret = "aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vW1xY"

  .repeat(2)

  .slice(0, 64)

const valid = loadProductionConfig({
  databaseSsl: "true",

  jwtSecret: secureSecret,
})

assert.equal(
  valid.status,

  0,

  "Une configuration TLS et clé forte doit être acceptée.",
)

assert.ok(
  !valid.stdout.includes(secureSecret) && !valid.stderr.includes(secureSecret),

  "Le contrôle ne doit jamais afficher la clé JWT.",
)

const runtimeEnvironment = loadProductionConfigFromRuntimeEnvironment({
  databaseUrl: databaseUrl,

  jwtSecret: secureSecret,
})

assert.equal(
  runtimeEnvironment.status,

  0,

  "La configuration de production injectée explicitement doit être acceptée.",
)

assert.ok(
  !runtimeEnvironment.stdout.includes(secureSecret) &&
    !runtimeEnvironment.stderr.includes(secureSecret),

  "Le contrôle ne doit jamais afficher la clé JWT injectée.",
)

const insecureDatabase = loadProductionConfig({
  databaseSsl: "false",

  jwtSecret: secureSecret,
})

assert.notEqual(
  insecureDatabase.status,

  0,

  "La production doit refuser PostgreSQL sans TLS.",
)

assert.ok(
  !insecureDatabase.stdout.includes(secureSecret) &&
    !insecureDatabase.stderr.includes(secureSecret),

  "Le contrôle ne doit jamais afficher la clé JWT.",
)

const shortSecret = loadProductionConfig({
  databaseSsl: "true",

  jwtSecret: "short-secret",
})

assert.notEqual(
  shortSecret.status,

  0,

  "La production doit refuser une clé JWT trop courte.",
)

const exampleSecret = loadProductionConfig({
  databaseSsl: "true",

  jwtSecret: "replace-with-a-random-secret-of-at-least-32-characters",
})

assert.notEqual(
  exampleSecret.status,

  0,

  "La production doit refuser la clé d’exemple.",
)

console.info(
  "Configuration de production : prérequis positifs et négatifs vérifiés.",
)
