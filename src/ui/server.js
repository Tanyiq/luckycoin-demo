import { createReadStream, existsSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { networkInterfaces } from "node:os"
import { extname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = fileURLToPath(new URL("../../", import.meta.url))
const port = Number(process.env.PORT ?? 4173)
const host = process.env.HOST ?? "0.0.0.0"
const healthPath = "/__luckycoin_health"
const healthResponse = "luckycoin-demo"
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav"
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://local").pathname)
  const requested = pathname === "/" ? "/index.html" : pathname
  const target = normalize(join(projectRoot, requested))
  return target.startsWith(projectRoot) ? target : null
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://local").pathname
  if (pathname === healthPath) {
    response.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    })
    response.end(healthResponse)
    return
  }
  const target = resolveRequestPath(request.url)
  if (!target || !existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    response.end("Not found")
    return
  }
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(target)] ?? "application/octet-stream",
    "Cache-Control": "no-store"
  })
  createReadStream(target).pipe(response)
})

server.listen(port, host, () => {
  console.log(`命运硬币 Demo 已启动：http://localhost:${port}`)
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter(
      (address) =>
        address?.family === "IPv4" &&
        !address.internal
    )
    .map((address) => `http://${address.address}:${port}`)
  if (addresses.length > 0) {
    console.log("同一 Wi-Fi 下，手机可以打开：")
    addresses.forEach((address) => console.log(`  ${address}`))
  }
  console.log("关闭此窗口即可停止 Demo。")
})
