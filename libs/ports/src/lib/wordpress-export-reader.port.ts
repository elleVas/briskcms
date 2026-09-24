/** One entry of a WordPress export, whatever kind of thing it is. */
export interface WordPressExportItem {
  postId: number | null;
  postType: string;
  status: string;
  title: string;
  slug: string;
  parentId: number | null;
  menuOrder: number;
  link: string;
  content: string;
  excerpt: string;
  /** Keys only — an export's postmeta values are most of its weight, and the adapter keeps a value only when asked. */
  metaKeys: string[];
  metaValues: Record<string, string>;
  terms: { taxonomy: string; slug: string; name: string }[];
  attachmentUrl: string;
}

export interface WordPressExportChannel {
  title: string;
  baseSiteUrl: string;
  baseBlogUrl: string;
  terms: {
    taxonomy: string;
    slug: string;
    name: string;
    parentSlug: string;
  }[];
}

/**
 * Reading a WordPress export, one entry at a time.
 *
 * A callback rather than a returned list, and that is the contract: a real
 * export is hundreds of megabytes (314 MB on the first client site this
 * was measured against, 43 597 entries), so nothing may assume it fits in
 * memory. An implementation streams; a caller counts.
 */
export interface WordPressExportReaderPort {
  read(
    filePath: string,
    onItem: (item: WordPressExportItem) => void,
    options?: { keepMetaValues?: readonly string[] },
  ): Promise<WordPressExportChannel>;
}
