import http from "node:http";
import { messages } from "./messages";

const DEFAULT_PORT = 8080;

/**
 * Northflank等のPaaSがポート監視でプロセスの生存確認を行うための軽量サーバー。
 * discord.jsのgateway接続とは独立して動かすため、失敗してもプロセスは落とさない。
 */
export function startHealthServer(
  port: number = Number(process.env.PORT) || DEFAULT_PORT,
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.on("error", (error) => {
    console.error(messages.health.startError, error);
  });

  server.listen(port, () => {
    console.info(messages.health.listening(port));
  });

  return server;
}
