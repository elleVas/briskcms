export type StorageProvider = 'local' | 's3';

export interface MediaProps {
  id: string;
  tenantId: string;
  siteId: string;
  filename: string;
  storageKey: string;
  storageProvider: StorageProvider;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export class Media {
  private constructor(private props: MediaProps) {}

  static create(input: Omit<MediaProps, 'createdAt'> & { now?: Date }): Media {
    const { now, ...rest } = input;
    return new Media({ ...rest, createdAt: now ?? new Date() });
  }

  static fromProps(props: MediaProps): Media {
    return new Media({ ...props });
  }

  toProps(): MediaProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get siteId(): string {
    return this.props.siteId;
  }

  get filename(): string {
    return this.props.filename;
  }

  get storageKey(): string {
    return this.props.storageKey;
  }

  get storageProvider(): StorageProvider {
    return this.props.storageProvider;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get size(): number {
    return this.props.size;
  }

  get width(): number | null {
    return this.props.width;
  }

  get height(): number | null {
    return this.props.height;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
