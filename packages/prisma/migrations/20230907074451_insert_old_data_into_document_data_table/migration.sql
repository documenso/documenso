INSERT INTO
  "DocumentData" ("id", "type", "data", "initialData", "documentId") (
    SELECT
      CAST(gen_random_uuid() AS TEXT),
      'BYTES_64',
      d."document",
      d."document",
      d."id"
    FROM
      "Document" d
    WHERE
      d."id" IS NOT NULL
      AND d."document" IS NOT NULL
  );
