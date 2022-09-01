import { log } from "../deps.ts";
import { File, Link, Torrent, Tracker } from "./types.ts";

const USER_AGENT = Deno.env.USER_AGENT || "deno";
const API_VERSION = 2;

export enum Filter {
  All = "all",
  Downloading = "downloading",
  Seeding = "seeding",
  Completed = "completed",
  Resumed = "resumed",
  Paused = "paused",
  Active = "active",
  Inactive = "inactive",
  Stalled = "stalled",
  StalledUploading = "stalled_uploading",
  StalledDownloading = "stalled_downloading",
  Checking = "checking",
  Errored = "errored",
}

interface ListParams {
  filter?: Filter;
  category?: string;
  tag?: string;
  sort?: string;
  reverse?: boolean;
  limit?: number;
  offset?: number;
  hashes?: string;
}

interface AddParams {
  /** Download folder */
  savepath: string;
  /** Cookie sent to download the .torrent file */
  cookie: string;
  /** Category for the torrent */
  category: string;
  /** Tags for the torrent, split by ',' */
  tags: string;
  /** Skip hash checking. Default false */
  skipChecking: boolean;
  /** Add torrents in the paused state. Default false */
  paused: boolean;
  /** Create the root folder. Possible values are true, false, unset (default) */
  rootFolder: boolean;
  /** Rename torrent */
  rename: string;
  /** Set torrent upload speed limit. Unit in bytes/second */
  upLimit: number;
  /** Set torrent download speed limit. Unit in bytes/second */
  dlLimit: number;
  /** Set torrent share ratio limit */
  ratioLimit: number;
  /** Set torrent seeding time limit. Unit in seconds */
  seedingTimeLimit: number;
  /** Whether Automatic Torrent Management should be used */
  autoTMM: boolean;
  /** Enable sequential download. Default false */
  sequentialDownload: boolean;
  /** Prioritize download first last piece. Default false */
  firstLastPiecePrio: boolean;
}

interface ITorrent {
  // readonly [index: string]: Function;
  login(): Promise<Response>;
  logout(): Promise<Response>;
  readonly version: Promise<string>;
  readonly webapiVersion: Promise<string>;
  readonly buildInfo: Promise<Record<string, unknown>>;
  readonly preferences: Promise<Record<string, unknown>>;
  shutdown(): Promise<Response>;
  torrents(params: ListParams): Promise<Torrent[]>;
  properties(hash: string): Promise<Torrent>;
  trackers(hash: string): Promise<Tracker[]>;
  webseeds(hash: string): Promise<Link[]>;
  files(hash: string, indexes?: string): Promise<File[]>;
  pieceStates(hash: string): Promise<number[]>;
  pieceHashes(hash: string): Promise<string[]>;
  pause(hashes: string): Promise<Response>;
  resume(hashes: string): Promise<Response>;
  delete(hashes: string, deleteFiles: boolean): Promise<Response>;
  recheck(hashes: string): Promise<Response>;
  reannounce(hashes: string): Promise<Response>;
  add(
    torrent: Torrent,
    options: { check?: boolean; paused?: boolean },
  ): Promise<Response>;
}

/**
 * A client to talk to a qBittorrent server.
 *
 * ## Examples
 *
 * ```ts
 * import { qBittorrent } from "./client.ts";
 *
 * const client = new qBittorrent("http://admin:adminadmin@localhost:8080");
 * try {
 *   await client.login();
 * } catch(error) {
 *   console.error(error);
 * }
 *
 * // Display qBittorrent info
 * console.log(`qBittorrent: ${ await client.version }`);
 * console.log(`qBittorrent Web API: ${ await client.webapiVersion }`);
 * Object.entries(await client.buildInfo).forEach(([key, value]) => {
 *   console.log(`${ key }: ${ value }`);
 * });
 *
 * // Retrieve and show all torrents
 * for await (const torrent of await client.torrents()) {
 *   console.log(`${ torrent.hash }: ${ torrent.name } (${ torrent.state })`);
 * }
 * ```
 */
export class qBittorrent implements ITorrent {
  #url: URL;
  #headers: Headers;

  static async connect(url: string, options) {
    const client = new qBittorrent(url, options);
    await client.login();
    return client;
  }

  constructor(url = "http://admin:adminadmin@localhost:8080", options = {}) {
    this.#url = new URL(url);
    const headers = new Headers();
    headers.set("Referer", this.#url.origin);
    headers.set("User-Agent", USER_AGENT);
    headers.set(
      "Content-Type",
      "application/x-www-form-urlencoded;charset=UTF-8",
    );

    this.#headers = headers;

    const { logLevel = log.LogLevels.WARNING } = options;

    // Adds default logging functions.
    Object.assign(this, log);
    this.getLogger().level = logLevel;
  }

  api(
    path: string,
    init: RequestInit & { body?: Record<string, unknown> } = {},
  ) {
    const { origin } = this.#url;
    let {
      body,
      headers,
      method = body ? "POST" : "GET",
      ...others
    } = init;

    if (body) {
      // Normalizes params and removes key with `undefined` value.
      body = new URLSearchParams(JSON.parse(JSON.stringify(body)));
    }

    this.debug(`Fetching ${origin}/api/v${API_VERSION}/${path}`);

    return fetch(`${origin}/api/v${API_VERSION}/${path}`, {
      method,
      headers: {
        ...this.#headers,
        ...headers,
      },
      body,
      credentials: "include",
      ...others,
    });
  }

  async login({ username, password } = this.#url) {
    const response = await this.api("auth/login", {
      body: {
        username,
        password,
      },
      credentials: "include",
    });

    const { ok, statusText, headers } = response;

    if (!ok) {
      throw new Error(statusText);
    }

    this.debug(`User ${username} is logged in`);

    const cookies = headers.get("Set-Cookie");
    this.#headers.set("Cookie", cookies);

    return response;
  }

  async logout() {
    const response = await this.api("auth/logout");
    this.#headers.delete("Cookie");
    this.debug(`User ${this.#url.username} is logged out`);

    return response;
  }

  get version() {
    return this.api("app/version").then((response) => response.text());
  }

  get webapiVersion() {
    return this.api("app/webapiVersion").then((response) => response.text());
  }

  get buildInfo() {
    return this.api("app/buildInfo").then((response) => response.json());
  }

  get preferences() {
    return this.api("app/preferences").then((response) => response.json());
  }

  shutdown(): Promise<Response> {
    return this.api("app/shutdown");
  }

  /**
   * Get torrent list
   */
  async torrents(body: ListParams = {}): Promise<Torrent[]> {
    const response = await this.api("torrents/info", { body });
    const torrents = await response.json();

    this.debug(`${torrents.length} torrents matching ${JSON.stringify(body)}`);

    return torrents;
  }

  async properties(hash: string): Promise<Torrent> {
    const response = await this.api("torrents/properties", { body: { hash } });
    if (response.ok) {
      return response.json();
    }

    return null;
  }

  async trackers(hash: string): Promise<Tracker[]> {
    const response = await this.api("torrents/trackers", { body: { hash } });
    if (response.ok) {
      return response.json();
    }

    return [];
  }

  async webseeds(hash: string): Promise<Link[]> {
    const response = await this.api("torrents/webseeds", { body: { hash } });
    if (response.ok) {
      return response.json();
    }

    return [];
  }

  async files(hash: string, indexes?: string): Promise<File[]> {
    const response = await this.api("torrents/files", {
      body: { hash, indexes },
    });
    if (response.ok) {
      return response.json();
    }

    return [];
  }

  async pieceStates(hash: string): Promise<number[]> {
    const response = await this.api("torrents/pieceStates", { body: { hash } });
    if (response.ok) {
      return response.json();
    }

    return [];
  }

  async pieceHashes(hash: string): Promise<string[]> {
    const response = await this.api("torrents/pieceHashes", { body: { hash } });
    if (response.ok) {
      return response.json();
    }

    return [];
  }

  pause(hashes: string): Promise<Response> {
    return this.api("torrents/pause", { body: { hashes } });
  }

  resume(hashes: string): Promise<Response> {
    return this.api("torrents/resume", { body: { hashes } });
  }

  /**
   * Delete torrents
   *
   * Needs the hashes of the torrents to delete, separated by `|`,
   * or `all`, to delete all torrents.
   *
   * If `deleteFiles` is set to `true`, the downloaded data will
   * also be deleted.
   */
  async delete(
    hashes: string,
    deleteFiles: boolean,
  ): Promise<Response> {
    const response = await this.api("torrents/delete", {
      body: {
        hashes,
        deleteFiles: !!deleteFiles,
      },
    });

    if (response.ok) {
      this.info(`Deleted torrent ${hashes}`);
    }

    return response;
  }

  recheck(hashes: string): Promise<Response> {
    return this.api("torrents/recheck", { body: { hashes } });
  }

  reannounce(hashes: string): Promise<Response> {
    return this.api("torrents/reannounce", { body: { hashes } });
  }

  /**
   * Adds new torrent from server local file or from URLs.
   *
   * `http://`, `https://`, `magnet:` and `bc://bt/` links are supported.
   */
  async add(
    urls: string[],
    options: Partial<AddParams> = {},
  ) {
    const skipChecking = options.skipChecking;
    const body = {
      urls,
      skip_checking: skipChecking,
      ...options,
    };
    delete body.skipChecking;

    const response = await this.api("torrents/add", { body });

    if (response.ok) {
      this.info(`Added ${urls}`);
    }

    return response;
  }
}
