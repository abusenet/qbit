#!/usr/bin/env -S deno run --allow-net --allow-env --allow-write

/**
 * Make a torrent file, similar to `mktorrent`, but sourced from existing info
 * from BitTorrent client.
 *
 * Usage:
 *
 * ```
 * $ mktorrent.ts -n Name -a announce/url -P hash output.torrent
 */

 import { encode } from "https://deno.land/x/bencode@v0.1.3/mod.ts";
 import { parse } from "../deps.ts";
 import { ITorrent, qBittorrent } from "../lib/client.ts";
 
 export function description() {
   return `mktorrent
   Creates BitTorrent metainfo files, often known simply as torrents.
 
 INSTALL:
   deno install --allow-net --allow-env --allow-write -n mktorrent https://deno.land/x/qbit/examples/mktorrent.ts
 USAGE:
   mktorrent [...options] <hash>
 OPTIONS:
   -a, --announce-list=<url>
     Specify the full announce URLs. Additional -a adds backup trackers.
   -c, --comment=<comment>
     Add a comment to the metainfo.
   -h, --help
     Show this help screen.
   -n, --name=<name>
     Set the name of the torrent. Default is the name of the source file.
   -o, --output=<filename>
     Set the path and filename of the created file. Default is <name>.torrent.
   -p, --private
     Set the private flag.`;
 }
 
 type Output = Deno.Writer & Deno.Closer & {
   readonly writable: WritableStream<Uint8Array>;
 };
 
 export interface MkTorrentOptions {
   "announce-list": string[];
   comment?: string;
   name?: string;
   output?: string | Output;
   "private"?: boolean;
   client?: ITorrent;
 }
 
 export async function mktorrent(
   hash: string,
   options: Partial<MkTorrentOptions> = {},
 ) {
   let {
     "announce-list": announceList = [],
     comment,
     name,
     output,
     "private": isPrivate,
     client = await qBittorrent.connect(Deno.env.QBITTORRENT_URL),
   } = options;
 
   // Uses `name` and/or `announce-list` from current torrent info if not defined.
   if (!name || !announceList.length) {
     const [torrent] = await client.torrents({ hashes: hash });
 
     if (!torrent) {
       throw new Error("Torrent does not exist");
     }
 
     if (!name) {
       name = torrent.name;
     }
 
     if (!announceList.length) {
       announceList.push(torrent.tracker);
     }
   }
 
   // Get more properties from the torrent.
   const {
     comment: existingComment,
     creation_date,
     created_by,
     piece_size,
   } = await client.properties(hash);
 
   // Uses `comment` from current torrent info if not defined in flags.
   if (!comment) {
     comment = existingComment || "";
   }
 
   // const trackers = await client.trackers(hash).then(ts => ts.filter(t => t.tier >= 0));
   const files = await client.files(hash).then((files) =>
     files.map(({ name, size }) => {
       const path = name.split("/");
       // In torrent with root folder, the path segments do not include that folder.
       path.shift();
       return {
         length: size,
         path,
       };
     })
   );
 
   const firstFile = files[0];
 
   const pieceHashes = await client.pieceHashes(hash);
   const pieces = new Uint8Array(pieceHashes.reduce((acc, hex) => {
     // Converts each hexadecimal character of the hash to bytes.
     for (let c = 0; c < hex.length; c += 2) {
       acc.push(parseInt(hex.substr(c, 2), 16));
     }
     return acc;
   }, []));
 
   const info = {
     name,
     length: firstFile.length,
     files,
     "piece length": piece_size,
     pieces,
     "private": Number(isPrivate),
   };
 
   if (files.length > 1) {
     // If there are multiple files, we don't set `length`.
     delete info.length;
   }
 
   if (files.length === 1) {
     // If there is only 1 file, we don't include the `files`.
     delete info.files;
   }
 
   const torrentFile: Uint8Array = encode({
     announce: announceList[0],
     "announce-list": announceList,
     comment,
     "created by": created_by,
     "creation date": creation_date,
     // encoding,
     info,
   });
 
   if (!output) {
     output = `${hash}.torrent`;
   }
 
   if (output === "-") {
     output = Deno.stdout;
   }
 
   if (typeof output === "string") {
     output = await Deno.open(output, {
       read: false,
       write: true,
       create: true,
       truncate: true,
     });
   }
 
   new Response(torrentFile.buffer).body!.pipeTo(output.writable);
 
   return torrentFile;
 }
 
 if (import.meta.main) {
   const parseOptions = {
     string: [
       "announce-list",
       "comment",
       "name", // Name of the torrent, default is the basename of the target
       "output",
     ],
     collect: [
       "announce-list",
     ],
     boolean: [
       "help",
       "private", // @TODO: Deduce it from original torrent.
     ],
     alias: {
       "announce-list": ["announce", "a"],
       "comment": "c",
       "help": "h",
       "name": "n",
       "output": "o",
       "private": "p",
     },
   };
 
   const {
     _: [hash],
     help,
     ...options
   } = parse(Deno.args, parseOptions);
 
   if (help) {
     console.error(description());
     Deno.exit();
   }
 
   if (!hash) {
     console.error("Missing input");
     console.error(description());
     Deno.exit();
   }
 
   await mktorrent(hash, options);
 }
 