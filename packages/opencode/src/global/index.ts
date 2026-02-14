import fs from "fs/promises"
import { xdgData, xdgCache, xdgConfig, xdgState } from "xdg-basedir"
import path from "path"
import os from "os"
import { readText, writeFile } from "@/util/fs-extra"

const app = "opencode"

const data = path.join(xdgData!, app)
const cache = path.join(xdgCache!, app)
const config = path.join(xdgConfig!, app)
const state = path.join(xdgState!, app)

export namespace Global {
  export const Path = {
    // Allow override via OPENCODE_TEST_HOME for test isolation
    get home() {
      return process.env.OPENCODE_TEST_HOME || os.homedir()
    },
    data,
    bin: path.join(data, "bin"),
    log: path.join(data, "log"),
    cache,
    config,
    state,
  }

  const CACHE_VERSION = "21"

  let initialized: Promise<void> | undefined

  export function init() {
    if (initialized) return initialized
    initialized = (async () => {
      await Promise.all([
        fs.mkdir(Path.data, { recursive: true }),
        fs.mkdir(Path.config, { recursive: true }),
        fs.mkdir(Path.state, { recursive: true }),
        fs.mkdir(Path.log, { recursive: true }),
        fs.mkdir(Path.bin, { recursive: true }),
      ])

      const version = await readText(path.join(Path.cache, "version")).catch(() => "0")
      if (version !== CACHE_VERSION) {
        try {
          const contents = await fs.readdir(Path.cache)
          await Promise.all(
            contents.map((item) =>
              fs.rm(path.join(Path.cache, item), {
                recursive: true,
                force: true,
              }),
            ),
          )
        } catch (e) {}
        await writeFile(path.join(Path.cache, "version"), CACHE_VERSION)
      }
    })()
    return initialized
  }
}
