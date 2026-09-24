import type {
  WordPressExportChannel,
  WordPressExportItem,
  WordPressExportReaderPort,
} from '@brisk/ports';
import { readWxr } from './read-wxr';

/**
 * `WordPressExportReaderPort` over a WXR file.
 *
 * A thin shell on purpose: `readWxr` knows about WordPress's XML and
 * nothing about what it is for, so a second source of the same shape —
 * the plugin the plan leaves in backlog — implements the port without
 * touching either.
 */
export class WxrExportReader implements WordPressExportReaderPort {
  read(
    filePath: string,
    onItem: (item: WordPressExportItem) => void,
    options: { keepMetaValues?: readonly string[] } = {},
  ): Promise<WordPressExportChannel> {
    return readWxr(filePath, onItem, options);
  }
}
