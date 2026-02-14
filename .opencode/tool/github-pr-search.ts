const DESCRIPTION = Deno.readTextFileSync(new URL("./github-pr-search.txt", import.meta.url))

async function githubFetch(endpoint, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export default {
  description: DESCRIPTION,
  args: {},
  async execute(args = {}) {
    const owner = "anomalyco"
    const repo = "opencode"
    const query = `${args.query ?? ""}`.trim()
    if (!query) throw new Error("query is required")
    const limit = Math.max(1, Number(args.limit ?? 10))
    const offset = Math.max(0, Number(args.offset ?? 0))
    const page = Math.floor(offset / limit) + 1
    const searchQuery = encodeURIComponent(`${query} repo:${owner}/${repo} type:pr state:open`)
    const result = await githubFetch(`/search/issues?q=${searchQuery}&per_page=${limit}&page=${page}&sort=updated&order=desc`)

    if (result.total_count === 0) return `No PRs found matching "${query}"`

    const prs = Array.isArray(result.items) ? result.items : []
    if (prs.length === 0) return `No other PRs found matching "${query}"`

    const formatted = prs.map((pr) => `${pr.title}\n${pr.html_url}`).join("\n\n")
    return `Found ${result.total_count} PRs (showing ${prs.length}):\n\n${formatted}`
  },
}
