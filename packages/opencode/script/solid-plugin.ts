import { transformAsync } from "npm:@babel/core"
// @ts-expect-error - Types not important.
import ts from "npm:@babel/preset-typescript"
// @ts-expect-error - Types not important.
import solid from "npm:babel-preset-solid@1.9.9"
import type { Plugin } from "npm:esbuild"

const solidTransformPlugin: Plugin = {
  name: "esbuild-plugin-solid",
  setup: (build) => {
    build.onLoad({ filter: /\/node_modules\/solid-js\/dist\/server\.js$/ }, async (args) => {
      const path = args.path.replace("server.js", "solid.js")
      const code = await Deno.readTextFile(path)
      return { contents: code, loader: "js" }
    })
    build.onLoad({ filter: /\/node_modules\/solid-js\/store\/dist\/server\.js$/ }, async (args) => {
      const path = args.path.replace("server.js", "store.js")
      const code = await Deno.readTextFile(path)
      return { contents: code, loader: "js" }
    })
    build.onLoad({ filter: /\.(js|ts)x$/ }, async (args) => {
      const code = await Deno.readTextFile(args.path)
      const transforms = await transformAsync(code, {
        filename: args.path,
        presets: [
          [
            solid,
            {
              moduleName: "@opentui/solid",
              generate: "universal",
            },
          ],
          [ts],
        ],
      })
      return {
        contents: transforms?.code ?? "",
        loader: "js",
      }
    })
  },
}

export default solidTransformPlugin
