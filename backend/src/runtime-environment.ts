let backendEnvironment: NodeJS.ProcessEnv = process.env

export function setBackendRuntimeEnvironment(environment: NodeJS.ProcessEnv) {
  backendEnvironment = environment
}

export function getBackendRuntimeEnvironment() {
  return backendEnvironment
}
