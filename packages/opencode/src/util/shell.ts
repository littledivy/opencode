function escapeArg(arg: unknown): string {
  if (arg && typeof arg === "object" && "raw" in (arg as any)) {
    return (arg as any).raw
  }
  const str = String(arg)
  if (/[^a-zA-Z0-9_./:=@%^+,\-]/.test(str)) {
    return "'" + str.replace(/'/g, "'\\''") + "'"
  }
  return str
}

export class ShellError extends Error {
  exitCode: number
  stdout: Uint8Array
  stderr: Uint8Array
  constructor(exitCode: number, stdout: Uint8Array, stderr: Uint8Array) {
    super(`Command failed with exit code ${exitCode}\n${new TextDecoder().decode(stderr)}`)
    this.name = "ShellError"
    this.exitCode = exitCode
    this.stdout = stdout
    this.stderr = stderr
  }
}

export interface ShellResult {
  exitCode: number
  stdout: Uint8Array
  stderr: Uint8Array
  text(): string
  lines(): string[]
  [Symbol.asyncIterator](): AsyncIterableIterator<string>
}

interface ShellOptions {
  _cwd?: string
  _env?: Record<string, string>
  _quiet?: boolean
  _nothrow?: boolean
  _throws?: boolean
}

interface ShellPromise extends Promise<ShellResult> {
  quiet(): ShellPromise
  nothrow(): ShellPromise
  throws(v: boolean): ShellPromise
  cwd(dir: string): ShellPromise
  env(vars: Record<string, string>): ShellPromise
  text(): Promise<string>
  lines(): AsyncIterable<string>
  arrayBuffer(): Promise<ArrayBuffer>
  [Symbol.asyncIterator](): AsyncIterableIterator<string>
}

function buildCmd(strings: TemplateStringsArray, values: unknown[]): string {
  let result = strings[0]
  for (let i = 0; i < values.length; i++) {
    const val = values[i]
    if (Array.isArray(val)) {
      result += val.map(escapeArg).join(" ")
    } else {
      result += escapeArg(val)
    }
    result += strings[i + 1]
  }
  return result
}

function execute(cmd: string, opts: ShellOptions): ShellPromise {
  const doExec = async (): Promise<ShellResult> => {
    const env = opts._env ? { ...Deno.env.toObject(), ...opts._env } : undefined
    const command = new Deno.Command("sh", {
      args: ["-c", cmd],
      cwd: opts._cwd,
      env,
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    })

    const output = await command.output()
    const exitCode = output.code
    const stdout = output.stdout
    const stderr = output.stderr

    const shouldThrow = opts._nothrow ? false : opts._throws !== false
    if (exitCode !== 0 && shouldThrow) {
      throw new ShellError(exitCode, stdout, stderr)
    }

    const result: ShellResult = {
      exitCode,
      stdout,
      stderr,
      text() {
        return new TextDecoder().decode(stdout).trim()
      },
      lines() {
        return new TextDecoder()
          .decode(stdout)
          .split("\n")
          .filter((l) => l.length > 0)
      },
      async *[Symbol.asyncIterator]() {
        const lines = new TextDecoder().decode(stdout).split("\n")
        for (const line of lines) {
          yield line
        }
      },
    }
    return result
  }

  const promise = doExec()
  const shellPromise = promise as ShellPromise

  shellPromise.quiet = () => {
    opts._quiet = true
    return execute(cmd, { ...opts })
  }

  shellPromise.nothrow = () => {
    return execute(cmd, { ...opts, _nothrow: true })
  }

  shellPromise.throws = (v: boolean) => {
    return execute(cmd, { ...opts, _throws: v })
  }

  shellPromise.cwd = (dir: string) => {
    return execute(cmd, { ...opts, _cwd: dir })
  }

  shellPromise.env = (vars: Record<string, string>) => {
    return execute(cmd, { ...opts, _env: { ...opts._env, ...vars } })
  }

  shellPromise.text = async () => {
    const result = await shellPromise
    return result.text()
  }

  shellPromise.arrayBuffer = async () => {
    const result = await shellPromise
    return result.stdout.buffer.slice(result.stdout.byteOffset, result.stdout.byteOffset + result.stdout.byteLength) as ArrayBuffer
  }

  shellPromise.lines = () => {
    return {
      async *[Symbol.asyncIterator]() {
        const result = await promise
        const lines = new TextDecoder().decode(result.stdout).split("\n")
        for (const line of lines) {
          yield line
        }
      },
    } as AsyncIterable<string> as any
  }

  shellPromise[Symbol.asyncIterator] = () => {
    return {
      _promise: promise,
      _lines: null as string[] | null,
      _index: 0,
      [Symbol.asyncIterator]() {
        return this
      },
      async next() {
        if (!this._lines) {
          const result = await this._promise
          this._lines = new TextDecoder().decode(result.stdout).split("\n")
        }
        if (this._index < this._lines.length) {
          return { value: this._lines[this._index++], done: false }
        }
        return { value: undefined, done: true }
      },
    } as AsyncIterableIterator<string>
  }

  return shellPromise
}

export function $(strings: TemplateStringsArray, ...values: unknown[]): ShellPromise {
  const cmd = buildCmd(strings, values)
  return execute(cmd, {})
}

$.ShellError = ShellError

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function readableStreamToText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const chunks: string[] = []
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(decoder.decode(value, { stream: true }))
  }
  return chunks.join("")
}
