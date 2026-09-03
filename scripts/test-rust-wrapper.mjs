import assert from "node:assert/strict"
import test from "node:test"

import { buildRustTestEnvironment, discoverArm64HomebrewXz } from "./test-rust.mjs"

test("leaves non-Darwin-arm64 environments unchanged", () => {
  const baseEnvironment = { LIBRARY_PATH: "/existing/lib", LDFLAGS: "-Wl,existing" }
  assert.deepEqual(
    buildRustTestEnvironment({
      platform: "linux",
      arch: "arm64",
      baseEnvironment,
      xzPrefix: "/opt/homebrew/opt/xz",
    }),
    baseEnvironment,
  )
})

test("prepends the discovered arm64 xz paths and preserves existing flags", () => {
  const environment = buildRustTestEnvironment({
    platform: "darwin",
    arch: "arm64",
    baseEnvironment: {
      LIBRARY_PATH: "/existing/lib",
      PKG_CONFIG_PATH: "/existing/pkgconfig",
      LDFLAGS: "-Wl,existing",
    },
    xzPrefix: "/arm64/xz",
  })

  assert.equal(environment.LIBRARY_PATH, "/arm64/xz/lib:/existing/lib")
  assert.equal(environment.PKG_CONFIG_PATH, "/arm64/xz/lib/pkgconfig:/existing/pkgconfig")
  assert.equal(environment.LDFLAGS, "-L/arm64/xz/lib -Wl,existing")
})

test("discovers xz only when brew returns a prefix containing liblzma", () => {
  const calls = []
  const prefix = discoverArm64HomebrewXz({
    platform: "darwin",
    arch: "arm64",
    environment: {},
    fileExists: (path) => path === "/arm64/xz/lib/liblzma.dylib",
    run: (command) => {
      calls.push(command)
      return command === "/opt/homebrew/bin/brew"
        ? { status: 0, stdout: "/arm64/xz\n" }
        : { status: 1, stdout: "" }
    },
  })

  assert.equal(prefix, "/arm64/xz")
  assert.deepEqual(calls, ["/opt/homebrew/bin/brew"])
})
