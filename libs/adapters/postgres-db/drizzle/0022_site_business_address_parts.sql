-- An address in parts instead of one line of prose (docs/adr/0081).
--
-- What was typed is kept, in `street`: it is the part of an address people
-- write first, and parsing "Via Roma 1, 00100 Roma" into fields would be
-- guessing. Whoever owns the site fills in the rest, and until they do the
-- site prints exactly what it printed before.
--
-- A blank string becomes NULL rather than an address with nothing in it,
-- so `hasBusinessInfo` keeps answering the same question.
ALTER TABLE "sites"
  ALTER COLUMN "business_address" TYPE jsonb
  USING CASE
    WHEN "business_address" IS NULL THEN NULL
    WHEN btrim("business_address") = '' THEN NULL
    ELSE jsonb_build_object(
      'street', "business_address",
      'postalCode', '',
      'city', '',
      'country', ''
    )
  END;
