# AGENTS

## Basic Policy

- Agents must think in English but always communicate with users in Japanese.
- Do not mention previous changes in comments

## Web Search Policy

### 1. Search Tools

- **Default:** Use **Brave Search** via the MCP servers integration for all queries, including fresh news queries (e.g., "today's events").
- **Fallback:** Use `gemini -p` **only if** the Brave MCP call for the current query returns an error (e.g., network/API failure, timeout) or Brave MCP is unavailable on this machine.

### 2. Prompt Format

When instructing Codex or CLAUDE mode to perform a web search with Brave MCP, use the following format:

```sh
brave-search "WebSearch: <your search query>"
```

You can also use a multi-line prompt to enforce structured output:

```sh
brave-search $'Please meet the following requirements:\n\
- Always perform a web search and list at least 3 source URLs\n\
- Summarize important points in bullet points\n\
Topic to research: "<your topic>"'
```

If falling back to Gemini CLI, use:

```sh
gemini -p "WebSearch: <your search query>"
```

### 3. Error Handling

- If Brave MCP returns an error (network, API failure, or service unavailable), then fall back to `gemini -p`.
- Do **not** preemptively select Gemini based on query type or prior failures; require an actual Brave error during the current attempt before falling back.
- If Gemini also fails with `429 Resource exhausted` or similar, abort the attempt instead of retrying immediately to avoid hitting rate limits.

### 4. Output Requirements

- Answers must include sources, making them more reliable and easier to verify.
- Following these rules helps stabilize prompt quality for Codex.
