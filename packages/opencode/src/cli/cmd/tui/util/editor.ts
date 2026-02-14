import { defer } from "@/util/defer"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CliRenderer } from "@opentui/core"
import { writeFile, readText } from "@/util/fs-extra"

export namespace Editor {
  export async function open(opts: { value: string; renderer: CliRenderer }): Promise<string | undefined> {
    const editor = process.env["VISUAL"] || process.env["EDITOR"]
    if (!editor) return

    const filepath = join(tmpdir(), `${Date.now()}.md`)
    await using _ = defer(async () => { try { await Deno.remove(filepath) } catch {} })

    await writeFile(filepath, opts.value)
    opts.renderer.suspend()
    opts.renderer.currentRenderBuffer.clear()
    const parts = editor.split(" ")
    const proc = new Deno.Command(parts[0], {
      args: [...parts.slice(1), filepath],
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }).spawn()
    await proc.status
    const content = await readText(filepath)
    opts.renderer.currentRenderBuffer.clear()
    opts.renderer.resume()
    opts.renderer.requestRender()
    return content || undefined
  }
}
