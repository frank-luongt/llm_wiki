import { describe, expect, it } from "vitest"

import {
  API_ENDPOINTS,
  buildApiCurlExample,
  buildChatCurlExample,
  buildMcpConfigExample,
} from "./api-server-section"

describe("API server endpoint documentation", () => {
  it("lists the project review endpoint", () => {
    expect(API_ENDPOINTS).toContainEqual({
      method: "GET",
      path: "/api/v1/projects/{id}/reviews",
      noteKey: "endpointReviewsNote",
    })
  })
})

describe("API server examples", () => {
  it("uses placeholders instead of live secrets", () => {
    const rendered = [
      buildApiCurlExample(false),
      buildChatCurlExample(),
      buildMcpConfigExample("/tmp/llm-wiki-mcp.js"),
    ].join("\n")

    expect(rendered).toContain("<your-token>")
    expect(rendered).not.toContain("$LLM_WIKI_API_TOKEN")
  })

  it("omits authentication only from unauthenticated read curl examples", () => {
    expect(buildApiCurlExample(true)).not.toContain("Authorization")
    expect(buildMcpConfigExample("/tmp/llm-wiki-mcp.js")).toContain(
      '"LLM_WIKI_API_TOKEN": "<your-token>"',
    )
  })
})
