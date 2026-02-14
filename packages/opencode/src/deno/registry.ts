import * as semver from "npm:semver"
import { Log } from "../util/log"

export namespace PackageRegistry {
  const log = Log.create({ service: "deno" })

  export async function info(pkg: string, field: string, cwd?: string): Promise<string | null> {
    try {
      const { DenoProc } = await import("./index")
      const output = await new Deno.Command(DenoProc.which(), {
        args: ["info", pkg, field],
        cwd,
        env: {
          ...process.env,
        },
      }).output()

      const stdout = new TextDecoder().decode(output.stdout)

      const value = stdout.trim()
      if (!value) return null
      return value
    } catch (err: any) {
      log.warn("deno info failed", { pkg, field, code: err.code, stderr: err.stderr })
      return null
    }
  }

  export async function isOutdated(pkg: string, cachedVersion: string, cwd?: string): Promise<boolean> {
    const latestVersion = await info(pkg, "version", cwd)
    if (!latestVersion) {
      log.warn("Failed to resolve latest version, using cached", { pkg, cachedVersion })
      return false
    }

    const isRange = /[\s^~*xX<>|=]/.test(cachedVersion)
    if (isRange) return !semver.satisfies(latestVersion, cachedVersion)

    return semver.compare(cachedVersion, latestVersion) === -1
  }
}
