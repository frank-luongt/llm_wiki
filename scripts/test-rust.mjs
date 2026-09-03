import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

function prepend(value, existing, separator) {
  return existing ? `${value}${separator}${existing}` : value
}

export function buildRustTestEnvironment({
  platform = process.platform,
  arch = process.arch,
  baseEnvironment = process.env,
  xzPrefix,
} = {}) {
  const environment = { ...baseEnvironment }
  if (platform !== "darwin" || arch !== "arm64" || !xzPrefix) return environment

  const libraryPath = `${xzPrefix}/lib`
  environment.LIBRARY_PATH = prepend(libraryPath, environment.LIBRARY_PATH, ":")
  environment.PKG_CONFIG_PATH = prepend(`${libraryPath}/pkgconfig`, environment.PKG_CONFIG_PATH, ":")
  environment.LDFLAGS = prepend(`-L${libraryPath}`, environment.LDFLAGS, " ")
  return environment
}

export function discoverArm64HomebrewXz({
  platform = process.platform,
  arch = process.arch,
  environment = process.env,
  fileExists = existsSync,
  run = spawnSync,
} = {}) {
  if (platform !== "darwin" || arch !== "arm64") return undefined

  const brewCandidates = [
    environment.HOMEBREW_PREFIX ? `${environment.HOMEBREW_PREFIX}/bin/brew` : undefined,
    "/opt/homebrew/bin/brew",
    "brew",
  ].filter(Boolean)

  for (const brew of [...new Set(brewCandidates)]) {
    const result = run(brew, ["--prefix", "xz"], { encoding: "utf8" })
    if (result.status !== 0) continue
    const prefix = result.stdout.trim()
    if (prefix && fileExists(`${prefix}/lib/liblzma.dylib`)) return prefix
  }
  return undefined
}

export function runRustTests(args = process.argv.slice(2)) {
  const xzPrefix = discoverArm64HomebrewXz()
  const environment = buildRustTestEnvironment({ xzPrefix })
  if (process.platform === "darwin" && process.arch === "arm64" && xzPrefix) {
    console.log(`[test:rust] using arm64 Homebrew xz from ${xzPrefix}`)
  }
  const result = spawnSync(
    "cargo",
    ["test", "--manifest-path", "src-tauri/Cargo.toml", "--lib", ...args],
    { env: environment, stdio: "inherit" },
  )
  if (result.error) throw result.error
  return result.status ?? 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runRustTests()
}
