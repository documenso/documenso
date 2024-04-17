INSERT INTO "SiteSettings" ("id", "enabled", "data")
VALUES (
    'site.banner',
    FALSE,
    jsonb_build_object(
      'content',
      'This is a test banner',
      'bgColor',
      '#000000',
      'textColor',
      '#ffffff'
    )
  );