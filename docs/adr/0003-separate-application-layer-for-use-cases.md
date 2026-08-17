# 0003 — Layer `application` separato per gli use case

**Stato**: Accettata — 2026-08-17

## Contesto

Il piano descrive `libs/domain-core` come "entità pure... zero dipendenze da
Postgres/Express/Puck", e `libs/ports` come le interfacce che gli adapter
implementano (`PageRepositoryPort`, `MediaStoragePort`, ...). Non elenca però dove
vivono gli **use case** (`crea pagina`, `salva draft`, `pubblica pagina`, `elenca
versioni`, `rollback a versione`), che per forza di cose devono dipendere sia dalle
entità di dominio sia dai Port che orchestrano.

Mettere gli use case dentro `domain-core` crea una dipendenza circolare:
`ports` deve importare i tipi entità da `domain-core` (es. `Page` come tipo di
ritorno di `PageRepositoryPort.findById`), ma se `domain-core` a sua volta importa
`PageRepositoryPort` da `ports` per i suoi use case, i due package si dipendono a
vicenda.

Opzioni considerate:
1. Nuova libreria `libs/application` (use case), dipende da `domain-core` + `ports`.
2. Use case come service NestJS dentro `apps/api`, niente libreria nuova.
3. I Port di cui il dominio ha bisogno (`PageRepositoryPort`, `PageVersionRepositoryPort`)
   co-locati dentro `domain-core` stesso (schema classico dell'hexagonal architecture,
   dove il dominio possiede i port che consuma); `libs/ports` diventa un re-export di
   quelli più i port che il dominio non orchestra mai direttamente (`MediaStoragePort`,
   `AuthPort`).

## Decisione

Opzione 1: nuova libreria `libs/application`.

- `domain-core`: solo entità pure (`Page`, `PageVersion`, `User`, `Media`,
  `FormSubmission`) ed errori di dominio. Zero dipendenze da `ports`.
- `ports`: dipende da `domain-core` per i tipi usati nelle firme, definisce
  `PageRepositoryPort`, `PageVersionRepositoryPort`, `MediaStoragePort`, `AuthPort`,
  `TenantContextPort`.
- `application`: dipende da `domain-core` + `ports`, contiene gli use case come
  funzioni pure `(deps, input) => Promise<Output>` — testabili in isolamento con
  repository in-memory, senza NestJS.
- `apps/api`: dipende da `application` + `ports` + gli adapter concreti, fa il
  wiring DI (Nest inietta le implementazioni concrete dietro alle interfacce Port).

## Conseguenze

- Nessuna dipendenza circolare tra librerie.
- Gli use case restano testabili senza framework (vedi
  `libs/application/src/lib/use-cases/page-lifecycle.spec.ts`, il test end-to-end
  draft → publish → rollback con repository fake).
- Aggiunge una libreria non elencata esplicitamente nell'albero "indicativo" del
  piano originale — accettato perché il piano stesso descrive `domain-core` come
  "entità pure", quindi gli use case non erano comunque pensati per starci dentro;
  `application` nomina semplicemente il layer applicativo che l'hexagonal
  architecture prevede sempre.
- Le fasi successive (media, form, auth, multilingua) aggiungeranno i loro use case
  qui, non dentro `domain-core` né dentro `apps/api` direttamente.
