# qbit

qBittorrent client in Deno

## Prerequisite

Deno must be installed. Instructions can be found at 
https://deno.land/manual/getting_started/installation

## Usage

Basic usage

```ts
import { qBittorrent } from 'https://deno.land/x/qbit/mod.ts';

const client = new qBittorrent(Deno.env.QBITTORRENT_URL);
await client.login();

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
```

## Examples

A couple examples are provided in [examples](./examples/) folder that
demonstrate the various usage of this library.

- [Basic Example](./examples/basic.ts): The above example.
- [mktorrent](./examples/mktorrent.ts): `mktorrent` clone.
- [retorrent](./examples/retorrent.ts): reload torrent files.

Some examples are made as a CLI tool, so they can be run directly from
the source:

```shell
$ deno run -A https://deno.land/x/qbit/examples/mktorrent.ts {sha1hash} [flags]
$ deno run -A https://deno.land/x/qbit/examples/retorrent.ts [flags]
```