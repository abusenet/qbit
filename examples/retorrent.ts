#!/usr/bin/env -S deno run --allow-net --allow-env

import { parse } from "../deps.ts";
import { qBittorrent } from "../lib/client.ts";
import { mktorrent } from "./mktorrent.ts";

export function description() {
  return `retorrent
  Reload torrents based on params.

INSTALL:
  deno install --allow-net --allow-env -n retorrent https://deno.land/x/qbit/examples/retorrent.ts
USAGE:
retorrent [...options]
OPTIONS:
  --category=<category>
    Filters only torrents in the specified category
  --check, --no-check
    Whether to check data after adding.
  --filter=<state>
    Filters only torrents in the specified state.
    Allowed state filters: all, downloading, seeding, completed, paused, active, inactive, resumed, stalled, stalled_uploading, stalled_downloading, errored, checking
  --hashes
    Filter by hashes. Can contain multiple hashes separated by |
  -h, --help
    Show this help screen.
  --tag=<tag>
    Filters only torrents with the specified tag
  -v, --verbose
    Show more information. Additional -a increases verbosity.`;
}

const flags = parse(Deno.args, {
  string: [
    "category",
    "filter",
    "hashes",
    "tag",
  ],
  boolean: [
    "check",
    "help",
    "verbose",
  ],
  negatable: [
    "check",
  ],
  collect: [
    "verbose",
  ],
  alias: {
    "help": ["h"],
    "verbose": ["v"],
  },
  default: {
    "check": true,
  },
});

const {
  category,
  check,
  filter,
  hashes,
  help,
  tag,
  verbose,
} = flags;

if (help) {
  console.error(description());
  Deno.exit();
}

let logLevel;
switch (verbose.length) {
  case 0:
    break;
  case 1:
    logLevel = 20; // INFO
    break;
  default:
    logLevel = 10; // Can only go as low as DEBUG.
    break;
}

// Instantiate a Client using the appropriate WebUI configuration
const client = await qBittorrent.connect(Deno.env.QBITTORRENT_URL, {
  logLevel,
});

const torrents = await client.torrents({ filter, category, tag, hashes });
for await (const torrent of torrents) {
  const {
    hash,
    name,
    tracker,

    save_path,
    category,
    tags,
    up_limit,
    dl_limit,
    ratio_limit,
    seeding_time_limit,
    auto_tmm,
    seq_dl,
    f_l_piece_prio,
  } = torrent;

  // Uses a default transform stream that `mktorrent` can write to.
  const output = new TransformStream();

  // Builds a new torrent file into the stream.
  const metadata = await mktorrent(hash, {
    name,
    "announce-list": [tracker],
    private: true,
    output,
    client,
  });

  const torrentFile = new File([metadata], `${hash}.torrent`);

  // Deletes old entry in client.
  await client.delete(hash);
  // Adds back a new torrent that has just been made.
  await client.add([torrentFile], {
    savepath: save_path,
    category,
    tags,
    skipChecking: !check,
    upLimit: up_limit,
    downLimit: dl_limit,
    ratioLimit: ratio_limit,
    seedingTimeLimit: seeding_time_limit,
    autoTMM: auto_tmm,
    sequentialDownload: seq_dl,
    firstLastPiecePrio: f_l_piece_prio,
  });
}
