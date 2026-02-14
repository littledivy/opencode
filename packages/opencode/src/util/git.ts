import { $ } from "./shell"
import { Flag } from "../flag/flag"

export interface GitResult {
  exitCode: number
  text(): string | Promise<string>
  stdout: Buffer | ReadableStream<Uint8Array>
  stderr: Buffer | ReadableStream<Uint8Array>
}

/**
 * Run a git command.
 *
 * When the process is running as an ACP client, child processes inherit the
 * parent's stdin pipe which carries protocol data – on Windows this causes
 * git to deadlock.  In that case we fall back to Deno.Command with
 * stdin: "null".
 */
export async function git(args: string[], opts: { cwd: string; env?: Record<string, string> }): Promise<GitResult> {
  if (Flag.OPENCODE_CLIENT === "acp") {
    try {
      const cmd = new Deno.Command("git", {
        args,
        stdin: "null",
        stdout: "piped",
        stderr: "piped",
        cwd: opts.cwd,
        env: opts.env ? { ...process.env, ...opts.env } : undefined,
      })
      const output = await cmd.output()
      const stdoutBuf = Buffer.from(output.stdout)
      const stderrBuf = Buffer.from(output.stderr)
      return {
        exitCode: output.code,
        text: () => stdoutBuf.toString(),
        stdout: stdoutBuf,
        stderr: stderrBuf,
      }
    } catch (error) {
      const stderr = Buffer.from(error instanceof Error ? error.message : String(error))
      return {
        exitCode: 1,
        text: () => "",
        stdout: Buffer.alloc(0),
        stderr,
      }
    }
  }

  const env = opts.env ? { ...process.env, ...opts.env } : undefined
  let cmd = $`git ${args}`.quiet().nothrow().cwd(opts.cwd)
  if (env) cmd = cmd.env(env)
  const result = await cmd
  return {
    exitCode: result.exitCode,
    text: () => result.text(),
    stdout: result.stdout,
    stderr: result.stderr,
  }
}
