export type ScannedJobLink = {
  title: string;
  url: string;
  location?: string | null;
  description?: string | null;
  source?: string;
};

export type DiscoveryTarget = {
  name: string;
  website: string | null;
  careersUrl: string;
};

export type DiscoveryResult = {
  links: ScannedJobLink[];
  /**
   * Which tier produced the links. Recorded on the scan so a zero-result scan can be
   * told apart from a scan that fell all the way through to the anchor scraper.
   */
  strategy: string;
};
