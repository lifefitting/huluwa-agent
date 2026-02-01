import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

function secretsDir() {
  return path.join(os.homedir(), ".config", "huluwa-agent");
}

function credsPath() {
  return path.join(secretsDir(), "credentials.json");
}

function tokenPath() {
  return path.join(secretsDir(), "token.json");
}

export async function getGmailClient() {
  fs.mkdirSync(secretsDir(), { recursive: true });

  if (!fs.existsSync(credsPath())) {
    throw new Error(
      `Missing OAuth credentials at ${credsPath()}\n` +
        `Create a Google Cloud OAuth Client (Desktop) and save credentials.json there.`
    );
  }

  const credentials = JSON.parse(fs.readFileSync(credsPath(), "utf8"));
  const { client_secret, client_id, redirect_uris } = credentials.installed ?? credentials.web ?? {};

  if (!client_id || !client_secret || !redirect_uris?.length) {
    throw new Error("Invalid credentials.json (expected installed/web.client_id/client_secret/redirect_uris)");
  }

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  if (fs.existsSync(tokenPath())) {
    const token = JSON.parse(fs.readFileSync(tokenPath(), "utf8"));
    oAuth2Client.setCredentials(token);
    return google.gmail({ version: "v1", auth: oAuth2Client });
  }

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("Authorize this app by visiting this url:\n", authUrl);
  const code = await prompt("\nPaste the code here: ");

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(tokenPath(), JSON.stringify(tokens, null, 2), { mode: 0o600 });
  console.log(`Token stored to ${tokenPath()}`);

  return google.gmail({ version: "v1", auth: oAuth2Client });
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((resolve) => rl.question(question, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}
