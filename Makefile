SCHEMA = packages/prisma/schema.prisma

.PHONY: build config pre-symlink post-symlink

build:
	npm ci
	npx turbo run build --filter=@documenso/remix...

config:
	envsubst < pm2-template.json > pm2.json

pre-symlink:
ifeq ($(findstring 01,$(shell hostname)), 01)
	npx prisma migrate deploy --schema $(SCHEMA)
endif

post-symlink:
	pm2 startOrReload pm2.json
