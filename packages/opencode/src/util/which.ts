export function which(name: string, opts?: { PATH?: string }): string | null {
  try {
    const cmd = new Deno.Command("which", {
      args: [name],
      env: opts?.PATH ? { ...Deno.env.toObject(), PATH: opts.PATH } : undefined,
      stdout: "piped",
      stderr: "null",
    })
    const result = cmd.outputSync()
    if (!result.success) return null
    return new TextDecoder().decode(result.stdout).trim() || null
  } catch {
    return null
  }
}
