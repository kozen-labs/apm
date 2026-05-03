.PHONY: build lint format type-check test test-watch clean

build:
	npm run build

lint:
	npm run lint

format:
	npm run format

type-check:
	npm run type-check

test:
	npm test

test-watch:
	npm run test:watch

clean:
	rm -rf dist coverage
