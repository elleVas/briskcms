-- Travasa sites.theme_tokens.blockStyles (mappa JSONB sparsa) nella nuova
-- tabella site_theme_block_styles (una riga per site+block_type) prima che
-- la colonna venga droppata in una migrazione successiva. Eseguita PRIMA
-- del drop così nessun dato reale va perso.
INSERT INTO site_theme_block_styles (tenant_id, site_id, block_type, style)
SELECT s.tenant_id, s.id, kv.key, kv.value
FROM sites s, jsonb_each(s.theme_tokens -> 'blockStyles') AS kv(key, value)
WHERE s.theme_tokens IS NOT NULL
  AND s.theme_tokens -> 'blockStyles' IS NOT NULL;
--> statement-breakpoint

-- RLS — stesso pattern di 0012_site_layout_sections_rls.sql, riusa
-- current_tenant() da 0001_rls_and_grants.sql. I grant sono già coperti
-- dalla clausola `alter default privileges` in 0001.
alter table site_theme_block_styles enable row level security;
--> statement-breakpoint
alter table site_theme_block_styles force row level security;
--> statement-breakpoint
create policy tenant_isolation on site_theme_block_styles using (tenant_id = current_tenant()) with check (tenant_id = current_tenant());
