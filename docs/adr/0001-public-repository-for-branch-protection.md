# 0001 — Repository pubblico per abilitare branch protection

**Stato**: Accettata — 2026-08-17

## Contesto

Il workflow non negoziabile del progetto richiede `main` protetto fin dal primo
commit: nessun push diretto, ogni modifica solo via Pull Request. Il piano iniziale
prevedeva un repository GitHub privato.

Alla creazione della ruleset di protezione su `main`, l'API GitHub ha risposto con
`403 Upgrade to GitHub Pro or make this repository public to enable this feature`:
i repository privati sugli account personali free non supportano branch protection
(classica o ruleset).

## Decisione

Il repository `elleVas/briskcms` è pubblico. Il documento di piano/business
(`piano-progetto-astro-cms.md`, analisi di mercato, licenza, posizionamento) resta
locale e gitignored — non finisce mai nel repository pubblico. Solo il codice
diventa pubblico.

## Conseguenze

- Branch protection attiva gratuitamente, coerente col workflow non negoziabile.
- Il codice è visibile a chiunque prima ancora del primo rilascio pubblico — accettabile
  perché la licenza FSL prevede comunque un'eventuale pubblicazione, e "self-hosted
  open source" è uno dei pilastri del prodotto.
- Se in futuro serve tornare privati (es. prima di aver formalizzato la licenza FSL),
  serve un upgrade a GitHub Pro per mantenere la branch protection.
