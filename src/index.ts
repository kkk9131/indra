import { GatewayServer } from "./channels/gateway/index.js";

const server = new GatewayServer(3001);
server.start();
