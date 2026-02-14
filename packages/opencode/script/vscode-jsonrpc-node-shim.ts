// ESM wrapper for vscode-jsonrpc/node (CJS module)
// Deno's CJS interop doesn't always expose named exports from complex __exportStar chains
// deno-lint-ignore-file
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const mod = require("vscode-jsonrpc/lib/node/main.js")
export const createMessageConnection = mod.createMessageConnection
export const StreamMessageReader = mod.StreamMessageReader
export const StreamMessageWriter = mod.StreamMessageWriter
export const createServerSocketTransport = mod.createServerSocketTransport
export const createClientSocketTransport = mod.createClientSocketTransport
export const createServerPipeTransport = mod.createServerPipeTransport
export const createClientPipeTransport = mod.createClientPipeTransport
export const generateRandomPipeName = mod.generateRandomPipeName
export const SocketMessageWriter = mod.SocketMessageWriter
export const SocketMessageReader = mod.SocketMessageReader
export const IPCMessageWriter = mod.IPCMessageWriter
export const IPCMessageReader = mod.IPCMessageReader
