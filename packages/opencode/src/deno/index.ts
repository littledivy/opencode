import z from "zod"
import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import { Filesystem } from "../util/filesystem"
import { NamedError } from "@opencode-ai/util/error"
import { readJSON, writeFile } from "../util/fs-extra"
import { Lock } from "../util/lock"
import { PackageRegistry } from "./registry"
import { proxied } from "@/util/proxied"
import { which as find } from "../util/which"

export namespace DenoProc {
  const log = Log.create({ service: "deno" })

  export async function run(cmd: string[], options?: any) {
    log.info("running", {
      cmd: [which(), ...cmd],
      ...options,
    })
    const command = new Deno.Command(which(), {
      args: cmd,
      cwd: options?.cwd as string | undefined,
      stdout: "piped",
      stderr: "piped",
      env: {
        ...process.env,
        ...options?.env,
      },
    })
    const result = await command.output()
    const code = result.code
    const stdout = new TextDecoder().decode(result.stdout)
    const stderr = new TextDecoder().decode(result.stderr)
    log.info("done", {
      code,
      stdout,
      stderr,
    })
    if (code !== 0) {
      throw new Error(`Command failed with exit code ${code}`)
    }
    return result
  }

  export function which() {
    const exec = process.execPath
    const base = path.basename(exec).toLowerCase()
    if (base.includes("deno")) return exec
    const deno = find("deno")
    if (deno) return deno
    return "deno"
  }

  export const InstallFailedError = NamedError.create(
    "DenoInstallFailedError",
    z.object({
      pkg: z.string(),
      version: z.string(),
    }),
  )

  export async function install(pkg: string, version = "latest") {
    using _ = await Lock.write("deno-install")

    const mod = path.join(Global.Path.cache, "node_modules", pkg)
    const pkgPath = path.join(Global.Path.cache, "package.json")
    const parsed = await readJSON(pkgPath).catch(async () => {
      const result = { dependencies: {} }
      await writeFile(pkgPath, JSON.stringify(result, null, 2))
      return result
    })
    const dependencies = parsed.dependencies ?? {}
    if (!parsed.dependencies) parsed.dependencies = dependencies
    const modExists = await Filesystem.exists(mod)
    const cachedVersion = dependencies[pkg]

    if (!modExists || !cachedVersion) {
      // continue to install
    } else if (version !== "latest" && cachedVersion === version) {
      return mod
    } else if (version === "latest") {
      const isOutdated = await PackageRegistry.isOutdated(pkg, cachedVersion, Global.Path.cache)
      if (!isOutdated) return mod
      log.info("Cached version is outdated, proceeding with install", { pkg, cachedVersion })
    }

    const args = [
      "add",
      "npm:" + pkg + "@" + version,
    ]

    log.info("installing package", {
      pkg,
      version,
    })

    await DenoProc.run(args, {
      cwd: Global.Path.cache,
    }).catch((e) => {
      throw new InstallFailedError(
        { pkg, version },
        {
          cause: e,
        },
      )
    })

    let resolvedVersion = version
    if (version === "latest") {
      const installedPkg = await readJSON(path.join(mod, "package.json")).catch(() => null)
      if (installedPkg?.version) {
        resolvedVersion = installedPkg.version
      }
    }

    parsed.dependencies[pkg] = resolvedVersion
    await writeFile(pkgPath, JSON.stringify(parsed, null, 2))
    return mod
  }
}
