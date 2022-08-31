#!/usr/bin/env -S deno run --allow-net --allow-env

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
 import { qBittorrent } from "../lib/client.ts";
 
 const { args, env } = Deno;
 
 const flags = parse(args, {
   string: [
     "announce-list",
     "name", // Name of the torrent, default is the basename of the target
     "comment",
   ],
   collect: [
     "announce-list",
   ],
   boolean: [
     "private", // @TODO: Deduce it from original torrent.
   ],
   alias: {
     "announce-list": ["announce", "a"],
     "comment": "c",
     "name": "n",
     "private": "P",
   },
 });
 
 let {
   _: [hash, output],
   "announce-list": announceList,
   comment,
   name,
   "private": isPrivate,
 } = flags;
 
 const client = await qBittorrent.connect(env.QBITTORRENT_URL);
 
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
   comment = existingComment;
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
 
 const bencode = encode({
   announce: announceList[0],
   "announce-list": announceList,
   comment,
   "created by": created_by,
   "creation date": creation_date,
   // encoding,
   info,
 });
 
 Deno.writeFile(output, bencode);
 