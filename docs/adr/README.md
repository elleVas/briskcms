# Architecture Decision Records

Registro delle decisioni architetturali di Brisk che comportano un trade-off reale
(più di un modo ragionevole di fare la stessa cosa). Non ogni scelta implementativa
merita una ADR — solo quelle dove qualcuno, in futuro, si chiederebbe "perché non
l'hanno fatto nell'altro modo?".

Formato: [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
— Titolo, Stato, Contesto, Decisione, Conseguenze.

Una ADR accettata non si modifica: se una decisione cambia, se ne scrive una nuova
che la supera esplicitamente (stato `Superseded by ADR-000X`).

| ADR | Titolo | Stato |
|---|---|---|
| [0001](0001-public-repository-for-branch-protection.md) | Repository pubblico per abilitare branch protection | Accettata |
| [0002](0002-non-superuser-role-for-rls-enforcement.md) | Ruolo Postgres non-superuser dedicato per l'app | Accettata |
| [0003](0003-separate-application-layer-for-use-cases.md) | Layer `application` separato per gli use case | Accettata |
