export interface SiteProps {
  id: string;
  tenantId: string;
  name: string;
  domain: string | null;
  defaultLocale: string;
  enabledLocales: string[];
  createdAt: Date;
}

export class Site {
  private constructor(private props: SiteProps) {}

  static fromProps(props: SiteProps): Site {
    return new Site({ ...props });
  }

  toProps(): SiteProps {
    return { ...this.props };
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get domain(): string | null {
    return this.props.domain;
  }

  get defaultLocale(): string {
    return this.props.defaultLocale;
  }

  get enabledLocales(): string[] {
    return this.props.enabledLocales;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
