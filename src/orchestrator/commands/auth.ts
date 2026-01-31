import { Command } from "commander";
import * as p from "@clack/prompts";
import { exec } from "child_process";
import http from "http";
import { URL } from "url";
import { XOAuth2Handler } from "../../platform/auth/x-oauth2.js";
import { getCredentialStore } from "../../platform/auth/credential-store.js";

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? `open "${url}"`
      : process.platform === "win32"
        ? `start "${url}"`
        : `xdg-open "${url}"`;
  exec(command);
}

export function registerAuthCommand(cli: Command): void {
  cli.addCommand(authCommand);
}

export const authCommand = new Command("auth")
  .description("Authentication commands")
  .addCommand(
    new Command("x")
      .description("Authenticate with X (Twitter)")
      .action(async () => {
        const clientId = process.env.X_CLIENT_ID;
        const clientSecret = process.env.X_CLIENT_SECRET;
        const redirectUri =
          process.env.X_REDIRECT_URI ?? "http://localhost:8976/callback";

        if (!clientId) {
          p.log.error("X_CLIENT_ID environment variable is not set");
          process.exit(1);
        }

        p.intro("X Authentication");

        const handler = new XOAuth2Handler({
          clientId,
          clientSecret,
          redirectUri,
        });

        const { url, state } = handler.generateAuthUrl();

        p.log.info(`Redirect URI: ${redirectUri}`);
        p.log.info("Opening browser for authentication...");
        p.log.info(`If browser doesn't open, visit:\n${url}`);

        // Start local server to receive callback
        const server = http.createServer(async (req, res) => {
          const reqUrl = new URL(req.url!, `http://localhost:8976`);

          if (reqUrl.pathname === "/callback") {
            const code = reqUrl.searchParams.get("code");
            const returnedState = reqUrl.searchParams.get("state");
            const error = reqUrl.searchParams.get("error");

            if (error) {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(`
                <html><body>
                <h1>Authentication Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
                </body></html>
              `);
              p.log.error(`Authentication failed: ${error}`);
              server.close();
              process.exit(1);
            }

            if (!code || !returnedState) {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(
                "<html><body><h1>Missing code or state</h1></body></html>",
              );
              return;
            }

            if (returnedState !== state) {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end("<html><body><h1>State mismatch</h1></body></html>");
              p.log.error("State mismatch - possible CSRF attack");
              server.close();
              process.exit(1);
            }

            try {
              p.log.step("Exchanging code for tokens...");
              const tokens = await handler.handleCallback(code, returnedState);

              // Get user info
              const userResponse = await fetch(
                "https://api.twitter.com/2/users/me",
                {
                  headers: {
                    Authorization: `Bearer ${tokens.accessToken}`,
                  },
                },
              );

              let username: string | undefined;
              if (userResponse.ok) {
                const userData = (await userResponse.json()) as {
                  data: { username: string };
                };
                username = userData.data.username;
              }

              // Save credentials
              const store = getCredentialStore();
              store.setXCredentials(tokens, username);

              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(`
                <html><body>
                <h1>Authentication Successful!</h1>
                <p>Logged in as: @${username ?? "unknown"}</p>
                <p>You can close this window.</p>
                </body></html>
              `);

              p.log.success(`Authenticated as @${username ?? "unknown"}`);
              p.log.info(
                `Token expires at: ${new Date(tokens.expiresAt).toLocaleString()}`,
              );
              p.outro("Authentication complete!");

              server.close();
              process.exit(0);
            } catch (err) {
              res.writeHead(500, { "Content-Type": "text/html" });
              res.end(`
                <html><body>
                <h1>Token Exchange Failed</h1>
                <p>${err instanceof Error ? err.message : "Unknown error"}</p>
                </body></html>
              `);
              p.log.error(
                `Token exchange failed: ${err instanceof Error ? err.message : err}`,
              );
              server.close();
              process.exit(1);
            }
          }
        });

        const port = new URL(redirectUri).port || "8976";
        server.listen(parseInt(port), () => {
          p.log.info(`Callback server listening on port ${port}`);
          openBrowser(url);
        });
      }),
  )
  .addCommand(
    new Command("status")
      .description("Show authentication status")
      .action(() => {
        const store = getCredentialStore();
        const xCreds = store.getXCredentials();

        p.intro("Authentication Status");

        if (xCreds) {
          const expired = store.isXTokenExpired();
          p.log.info(
            `X (Twitter): Authenticated as @${xCreds.username ?? "unknown"}`,
          );
          p.log.info(
            `  Token expires: ${new Date(xCreds.expiresAt).toLocaleString()}`,
          );
          p.log.info(`  Status: ${expired ? "❌ Expired" : "✅ Valid"}`);
        } else {
          p.log.info("X (Twitter): Not authenticated");
        }

        p.outro("");
      }),
  );
