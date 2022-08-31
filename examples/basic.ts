import { qBittorrent } from "../lib/client.ts";

// Instantiate a Client using the appropriate WebUI configuration
const client = new qBittorrent(Deno.env.QBITTORRENT_URL);
/**
 * The Client will automatically acquire/maintain a logged-in state
 * in line with any request. Therefore, this is not strictly necessary;
 * however, you may want to test the provided login credentials.
 */
try {
  await client.login();
} catch (error) {
  console.error(error);
}

// Display qBittorrent info
console.log(`qBittorrent: ${await client.version}`);
console.log(`qBittorrent Web API: ${await client.webapiVersion}`);
Object.entries(await client.buildInfo).forEach(([key, value]) => {
  console.log(`${key}: ${value}`);
});

// Retrieve and show all torrents
for await (const { name, hash, state } of await client.torrents()) {
  console.log(`${hash}: ${name} (${state})`);
}
