export interface Torrent {
  added_on: number;
  amount_left: number;
  auto_tmm: boolean;
  availability: number;
  category: string;
  comment: string;
  completed: number;
  completion_on: number;
  content_path: string;
  creation_date: string;
  created_by: string;
  dl_limit: number;
  dlspeed: number;
  download_path: string;
  downloaded: number;
  downloaded_session: number;
  eta: number;
  f_l_piece_prio: boolean;
  force_start: boolean;
  hash: string;
  infohash_v1: string;
  infohash_v2: string;
  last_activity: number;
  magnet_uri: string;
  max_ratio: number;
  max_seeding_time: number;
  name: string;
  num_complete: number;
  num_incomplete: number;
  num_leechs: number;
  num_seeds: number;
  piece_size: number;
  piece_have: number;
  pieces_num: number;
  priority: number;
  progress: number;
  ratio: number;
  ratio_limit: number;
  save_path: string;
  seeding_time: number;
  seeding_time_limit: number;
  seen_complete: number;
  seq_dl: boolean;
  size: number;
  state: string;
  super_seeding: boolean;
  tags: string;
  time_active: number;
  total_size: number;
  tracker: string;
  trackers_count: number;
  up_limit: number;
  uploaded: number;
  uploaded_session: number;
  upspeed: number;
}

export interface Link {
  url: string;
}

export enum TrackerStatus {
  Disabled, // Tracker is disabled (used for DHT, PeX, and LSD)
  NotContacted, // Tracker has not been contacted yet
  Working, // Tracker has been contacted and is working
  Updating, // Tracker is updating
  NotWorking, // Tracker has been contacted, but it is not working (or doesn't send proper replies)
}

export interface Tracker extends Link {
  status: TrackerStatus;
  tier: number;
  num_peers: number;
  num_seeds: number;
  num_leeches: number;
  num_downloaded: number;
  msg: string;
}

export interface File {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: number;
  is_seed: boolean;
  piece_range: [number, number];
  availability: number;
}
