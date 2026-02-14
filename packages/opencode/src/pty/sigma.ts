import { lazy } from "@opencode-ai/util/lazy"

export interface IDisposable {
  dispose(): void
}

export interface IExitEvent {
  exitCode: number
  signal?: number | string
}

export interface IPty {
  readonly pid: number
  readonly cols: number
  readonly rows: number
  readonly process: string
  readonly onData: (listener: (data: string) => void) => IDisposable
  readonly onExit: (listener: (event: IExitEvent) => void) => IDisposable
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
}

export interface IPtyForkOptions {
  name: string
  cols?: number
  rows?: number
  cwd?: string
  env?: Record<string, string>
}

class Event<T> {
  #listeners: ((data: T) => void)[] = []

  event = (listener: (data: T) => void): IDisposable => {
    this.#listeners.push(listener)
    return {
      dispose: () => {
        const i = this.#listeners.indexOf(listener)
        if (i < 0) return
        this.#listeners.splice(i, 1)
      },
    }
  }

  fire(data: T) {
    for (const listener of this.#listeners) {
      listener(data)
    }
  }
}

const load = lazy(() => import("jsr:@sigma/pty-ffi"))

class SigmaPty implements IPty {
  readonly pid = -1
  readonly process = "shell"
  #cols: number
  #rows: number
  #done = false
  #closed = false
  #data = new Event<string>()
  #exit = new Event<IExitEvent>()

  constructor(
    private readonly pty: {
      read: () => { data: string; done: boolean }
      write: (data: string) => void
      resize: (size: { cols: number; rows: number }) => void
      close: () => void
      exitCode?: number
    },
    opts: IPtyForkOptions,
  ) {
    this.#cols = opts.cols ?? 80
    this.#rows = opts.rows ?? 24
    this.#loop()
  }

  get cols() {
    return this.#cols
  }

  get rows() {
    return this.#rows
  }

  get onData() {
    return this.#data.event
  }

  get onExit() {
    return this.#exit.event
  }

  #finish(exitCode: number, signal?: number | string) {
    if (this.#done) return
    this.#done = true
    this.#exit.fire({ exitCode, signal })
  }

  async #loop() {
    while (!this.#closed) {
      let result: { data: string; done: boolean }
      try {
        result = this.pty.read()
      } catch {
        if (this.#closed) return
        this.#closed = true
        this.#finish(this.pty.exitCode ?? 1)
        return
      }
      if (result.done) {
        this.#closed = true
        this.#finish(this.pty.exitCode ?? 0)
        return
      }
      if (result.data) {
        this.#data.fire(result.data)
        continue
      }
      await new Promise((resolve) => setTimeout(resolve, 8))
    }
  }

  write(data: string) {
    if (this.#closed) return
    this.pty.write(data)
  }

  resize(cols: number, rows: number) {
    if (this.#closed) return
    this.#cols = cols
    this.#rows = rows
    this.pty.resize({ cols, rows })
  }

  kill(signal = "SIGTERM") {
    if (this.#closed) return
    this.#closed = true
    this.pty.close()
    this.#finish(this.pty.exitCode ?? 0, signal)
  }
}

export async function spawn(file: string, args: string[], options: IPtyForkOptions): Promise<IPty> {
  const mod = await load()
  const pty = new mod.Pty(file, {
    args,
    cwd: options.cwd,
    env: options.env,
  })
  if (options.cols && options.rows) {
    pty.resize({ cols: options.cols, rows: options.rows })
  }
  return new SigmaPty(pty, options)
}
