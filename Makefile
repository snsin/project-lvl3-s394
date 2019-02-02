install-deps:	
	npm install

start:
	npx babel-node -- src/bin/gendiff

publish:
	npm publish

lint:
	npx eslint .

build:
	rm -rf dist
	npm run build

coverage:
	rm -rf coverage
	npm run coverage

test:
	npm test

debug-test:
	DEBUG=page-loader:* npm test

.PHONY: test coverage debug-test
