/**
 * Contract tests for the TypeScript-to-Tauri embedding boundary.
 *
 * Embedding HTTP, provider authentication, response parsing, and retry
 * behavior are owned by the Rust `embedding_fetch` command and tested over
 * real loopback HTTP in `src-tauri/src/commands/search.rs`. These tests keep
 * TypeScript on that boundary: no browser/Node HTTP fallback and no direct
 * embedding-data egress.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInvoke = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>()
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}))

vi.mock("@/commands/fs", () => ({
  readFile: vi.fn(),
  listDirectory: vi.fn(),
}))

import {
  fetchEmbedding,
  getLastEmbeddingError,
  resetEmbeddingOptimizeAccountingForTests,
} from "./embedding"

const transportConfig = {
  enabled: true,
  endpoint: "http://127.0.0.1:1234/v1/embeddings",
  apiKey: "",
  model: "fake-embed",
}

beforeEach(() => {
  mockInvoke.mockReset()
  resetEmbeddingOptimizeAccountingForTests()
})

describe("fetchEmbedding Tauri transport contract", () => {
  it("returns the vector produced by the Rust embedding command", async () => {
    mockInvoke.mockResolvedValueOnce([0.1, 0.2, 0.3])

    await expect(fetchEmbedding("hello", transportConfig)).resolves.toEqual([0.1, 0.2, 0.3])
    expect(mockInvoke).toHaveBeenCalledOnce()
    expect(mockInvoke).toHaveBeenCalledWith("embedding_fetch", {
      text: "hello",
      cfg: transportConfig,
      maxRetries: 3,
    })
    expect(getLastEmbeddingError()).toBeNull()
  })

  it("passes an explicit retry budget through unchanged", async () => {
    mockInvoke.mockResolvedValueOnce([0.4, 0.5])

    await expect(fetchEmbedding("hello", transportConfig, 1)).resolves.toEqual([0.4, 0.5])
    expect(mockInvoke).toHaveBeenCalledWith("embedding_fetch", {
      text: "hello",
      cfg: transportConfig,
      maxRetries: 1,
    })
  })

  it("maps Rust failures to null and preserves the actionable error", async () => {
    mockInvoke.mockRejectedValueOnce(
      "Endpoint rejected input even at 64 chars. Lower Settings → Embedding → Max Chunk Chars.",
    )

    await expect(fetchEmbedding("a".repeat(128), transportConfig)).resolves.toBeNull()
    expect(getLastEmbeddingError()).toContain("Endpoint rejected input even at 64 chars")
  })

  it("does not invoke a transport when no endpoint is configured", async () => {
    await expect(fetchEmbedding("hello", { ...transportConfig, endpoint: "" })).resolves.toBeNull()
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})
