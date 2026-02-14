import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import { NamedError } from "@opencode-ai/util/error"
import { Log } from "../util/log"

const SUPPORTED_IDES = [
  { name: "Windsurf" as const, cmd: "windsurf" },
  { name: "Visual Studio Code - Insiders" as const, cmd: "code-insiders" },
  { name: "Visual Studio Code" as const, cmd: "code" },
  { name: "Cursor" as const, cmd: "cursor" },
  { name: "VSCodium" as const, cmd: "codium" },
]

export namespace Ide {
  const log = Log.create({ service: "ide" })

  export const Event = {
    Installed: BusEvent.define(
      "ide.installed",
      z.object({
        ide: z.string(),
      }),
    ),
  }

  export const AlreadyInstalledError = NamedError.create("AlreadyInstalledError", z.object({}))

  export const InstallFailedError = NamedError.create(
    "InstallFailedError",
    z.object({
      stderr: z.string(),
    }),
  )

  export function ide() {
    if (process.env["TERM_PROGRAM"] === "vscode") {
      const v = process.env["GIT_ASKPASS"]
      for (const ide of SUPPORTED_IDES) {
        if (v?.includes(ide.name)) return ide.name
      }
    }
    return "unknown"
  }

  export function alreadyInstalled() {
    return process.env["OPENCODE_CALLER"] === "vscode" || process.env["OPENCODE_CALLER"] === "vscode-insiders"
  }

  export async function install(ide: (typeof SUPPORTED_IDES)[number]["name"]) {
    const cmd = SUPPORTED_IDES.find((i) => i.name === ide)?.cmd
    if (!cmd) throw new Error(`Unknown IDE: ${ide}`)

    let stdout: string
    let stderr: string
    try {
      const output = await new Deno.Command(cmd, { args: ["--install-extension", "sst-dev.opencode"] }).output()
      stdout = new TextDecoder().decode(output.stdout)
      stderr = new TextDecoder().decode(output.stderr)
      if (!output.success) {
        throw { stdout, stderr, message: `Process exited with code ${output.code}` }
      }
    } catch (err: any) {
      log.info("install failed", { ide, stdout: err.stdout ?? "", stderr: err.stderr ?? "" })
      throw new InstallFailedError({ stderr: err.stderr ?? err.message })
    }

    log.info("installed", { ide, stdout, stderr })
    if (stdout.includes("already installed")) {
      throw new AlreadyInstalledError({})
    }
  }
}
