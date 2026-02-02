import "dotenv/config";
import { GatewayServer } from "./server.js";

const server = new GatewayServer();

async function main() {
  await server.start();
  await server.startDiscordBot();
  await server.startSlackBot();
}

main().catch(console.error);
