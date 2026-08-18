import type { OpeningHoursDay } from '@brisk/shared-types';

export interface SiteProps {
  id: string;
  tenantId: string;
  name: string;
  domain: string | null;
  defaultLocale: string;
  enabledLocales: string[];
  businessAddress: string | null;
  businessPhone: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
  createdAt: Date;
}

export interface UpdateBusinessInfoInput {
  businessAddress: string | null;
  businessPhone: string | null;
  businessType: string | null;
  openingHours: OpeningHoursDay[] | null;
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

  get businessAddress(): string | null {
    return this.props.businessAddress;
  }

  get businessPhone(): string | null {
    return this.props.businessPhone;
  }

  get businessType(): string | null {
    return this.props.businessType;
  }

  get openingHours(): OpeningHoursDay[] | null {
    return this.props.openingHours;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Used to render schema.org LocalBusiness markup (docs/adr/0014) — a
   * site with none of these set falls back to plain WebSite/WebPage, not
   * a broken LocalBusiness block.
   */
  hasBusinessInfo(): boolean {
    return (
      this.props.businessAddress !== null ||
      this.props.businessPhone !== null ||
      this.props.businessType !== null ||
      this.props.openingHours !== null
    );
  }

  updateBusinessInfo(input: UpdateBusinessInfoInput): void {
    this.props.businessAddress = input.businessAddress;
    this.props.businessPhone = input.businessPhone;
    this.props.businessType = input.businessType;
    this.props.openingHours = input.openingHours;
  }
}
