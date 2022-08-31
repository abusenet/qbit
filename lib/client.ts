import { log } from "../deps.ts";
import { Torrent } from "./types.ts";

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
export class qBittorrent {
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
    const { ok, statusText, headers } = await this.api("auth/login", {
      body: {
        username,
        password,
      },
      credentials: "include",
    });

    if (!ok) {
      throw new Error(statusText);
    }

    this.debug(`User ${username} is logged in`);

    const cookies = headers.get("Set-Cookie");
    this.#headers.set("Cookie", cookies);
    return cookies;
  }

  async logout() {
    await this.api("auth/logout");
    this.#headers.delete("Cookie");
    this.debug(`User ${this.#url.username} is logged out`);
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

    this.debug(`${ torrents.length } torrents matching ${ JSON.stringify(body) }`);

    return torrents;
  }
}
