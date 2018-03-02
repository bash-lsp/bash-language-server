clean:
	rm -rf node_modules server/node_modules vscode-client/node_modules vscode-client/server vscode-client/out

build: install
	npm run compile

install: package.json server/package.json vscode-client/package.json
	npm install
