const DESCRIPTION = Deno.readTextFileSync(new URL("./github-triage.txt", import.meta.url))

function getIssueNumber() {
  const issue = parseInt(process.env.ISSUE_NUMBER ?? "", 10)
  if (!issue) throw new Error("ISSUE_NUMBER env var not set")
  return issue
}

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
    const issue = getIssueNumber()
    const owner = "anomalyco"
    const repo = "opencode"
    const results = []
    const assignee = args.assignee ?? "rekram1-node"
    const labels = (Array.isArray(args.labels) ? args.labels : []).map((label) => (label === "desktop" ? "web" : label))

    if (assignee === "adamdotdevin" && !labels.includes("web")) {
      throw new Error("Only desktop issues should be assigned to adamdotdevin")
    }
    if (assignee === "fwang" && !labels.includes("zen")) {
      throw new Error("Only zen issues should be assigned to fwang")
    }
    if (assignee === "kommander" && !labels.includes("opentui")) {
      throw new Error("Only opentui issues should be assigned to kommander")
    }

    await githubFetch(`/repos/${owner}/${repo}/issues/${issue}/assignees`, {
      method: "POST",
      body: JSON.stringify({ assignees: [assignee] }),
    })
    results.push(`Assigned @${assignee} to issue #${issue}`)

    if (labels.length > 0) {
      await githubFetch(`/repos/${owner}/${repo}/issues/${issue}/labels`, {
        method: "POST",
        body: JSON.stringify({ labels }),
      })
      results.push(`Added labels: ${labels.join(", ")}`)
    }

    return results.join("\n")
  },
}
