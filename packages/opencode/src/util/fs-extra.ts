import { dirname } from "node:path"

export async function exists(filepath: string): Promise<boolean> {
  try {
    await Deno.stat(filepath)
    return true
  } catch {
    return false
  }
}

export async function isDir(filepath: string): Promise<boolean> {
  try {
    return (await Deno.stat(filepath)).isDirectory
  } catch {
    return false
  }
}

export async function readJSON<T = any>(filepath: string): Promise<T> {
  return JSON.parse(await Deno.readTextFile(filepath))
}

export async function readText(filepath: string): Promise<string> {
  return Deno.readTextFile(filepath)
}

export async function writeFile(filepath: string, data: string | Uint8Array): Promise<void> {
  await Deno.mkdir(dirname(filepath), { recursive: true })
  if (typeof data === "string") {
    await Deno.writeTextFile(filepath, data)
  } else {
    await Deno.writeFile(filepath, data)
  }
}

export async function writeFileWithMode(filepath: string, data: string | Uint8Array, mode: number): Promise<void> {
  await writeFile(filepath, data)
  await Deno.chmod(filepath, mode)
}

export function fileSize(filepath: string): number {
  try {
    return Deno.statSync(filepath).size
  } catch {
    return 0
  }
}
