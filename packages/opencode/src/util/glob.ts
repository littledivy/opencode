import { join, relative } from "node:path"

function globToRegExp(pattern: string): RegExp {
  let regex = pattern
    .replace(/\./g, "\\.")
    .replace(/\*\*\//g, "<<GLOBSTAR_DIR>>")
    .replace(/\*\*/g, "<<GLOBSTAR>>")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/<<GLOBSTAR_DIR>>/g, "(?:.*/)?")
    .replace(/<<GLOBSTAR>>/g, ".*")
    .replace(/\{([^}]+)\}/g, (_m, p1: string) => `(?:${p1.split(",").join("|")})`)
  return new RegExp(`^${regex}$`)
}

async function* walkDir(dir: string, followSymlinks?: boolean): AsyncGenerator<string> {
  try {
    for await (const entry of Deno.readDir(dir)) {
      const fullPath = join(dir, entry.name)
      let isDirectory = entry.isDirectory
      if (followSymlinks && entry.isSymlink) {
        try {
          isDirectory = (await Deno.stat(fullPath)).isDirectory
        } catch {
          isDirectory = false
        }
      }
      if (isDirectory) {
        yield* walkDir(fullPath, followSymlinks)
      } else {
        yield fullPath
      }
    }
  } catch {
    // Skip unreadable directories
  }
}

function* walkDirSync(dir: string, followSymlinks?: boolean): Generator<string> {
  try {
    for (const entry of Deno.readDirSync(dir)) {
      const fullPath = join(dir, entry.name)
      let isDirectory = entry.isDirectory
      if (followSymlinks && entry.isSymlink) {
        try {
          isDirectory = Deno.statSync(fullPath).isDirectory
        } catch {
          isDirectory = false
        }
      }
      if (isDirectory) {
        yield* walkDirSync(fullPath, followSymlinks)
      } else {
        yield fullPath
      }
    }
  } catch {
    // Skip unreadable directories
  }
}

export class Glob {
  #pattern: RegExp
  #raw: string
  constructor(pattern: string) {
    this.#raw = pattern
    this.#pattern = globToRegExp(pattern)
  }
  match(input: string): boolean {
    return this.#pattern.test(input)
  }
  async *scan(opts?: {
    cwd?: string
    onlyFiles?: boolean
    absolute?: boolean
    followSymlinks?: boolean
    dot?: boolean
  }): AsyncGenerator<string> {
    const cwd = opts?.cwd || Deno.cwd()
    for await (const entry of walkDir(cwd, opts?.followSymlinks)) {
      const rel = relative(cwd, entry)
      if (this.#pattern.test(rel)) {
        yield opts?.absolute ? entry : rel
      }
    }
  }
  *scanSync(opts?: {
    cwd?: string
    onlyFiles?: boolean
    absolute?: boolean
    followSymlinks?: boolean
    dot?: boolean
  }): Generator<string> {
    const cwd = opts?.cwd || Deno.cwd()
    for (const entry of walkDirSync(cwd, opts?.followSymlinks)) {
      const rel = relative(cwd, entry)
      if (this.#pattern.test(rel)) {
        yield opts?.absolute ? entry : rel
      }
    }
  }
}
