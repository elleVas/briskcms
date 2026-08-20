import type { FormField, FormStep } from '@brisk/shared-types';

export interface FormProps {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  fields: FormField[];
  // Empty by default — a plain single-step form, the shape every form had
  // before this field existed (docs/adr/0015's multi-step follow-up).
  steps: FormStep[];
  notificationEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFormProps {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  now?: Date;
}

/**
 * Entità pura: nessuna dipendenza da Postgres/Express/Puck (vedi
 * docs/adr/0015). `fields` è l'unica sorgente di verità per come il modulo
 * viene renderizzato pubblicamente e per come una submission viene
 * validata — non c'è un formato separato per editor/rendering/validazione.
 */
export class Form {
  private constructor(private props: FormProps) {}

  static create(input: CreateFormProps): Form {
    const now = input.now ?? new Date();
    return new Form({
      id: input.id,
      tenantId: input.tenantId,
      siteId: input.siteId,
      name: input.name,
      fields: [],
      steps: [],
      notificationEmail: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromProps(props: FormProps): Form {
    return new Form({ ...props });
  }

  toProps(): FormProps {
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

  get name(): string {
    return this.props.name;
  }

  get fields(): FormField[] {
    return this.props.fields;
  }

  get steps(): FormStep[] {
    return this.props.steps;
  }

  get notificationEmail(): string | null {
    return this.props.notificationEmail;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(
    input: {
      name: string;
      fields: FormField[];
      steps: FormStep[];
      notificationEmail: string | null;
    },
    now: Date = new Date(),
  ): void {
    this.props.name = input.name;
    this.props.fields = input.fields;
    this.props.steps = input.steps;
    this.props.notificationEmail = input.notificationEmail;
    this.props.updatedAt = now;
  }
}
