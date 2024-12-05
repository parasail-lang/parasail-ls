// import {
// 	createConnection,
// 	TextDocuments,
// 	Diagnostic,
// 	DiagnosticSeverity,
// 	ProposedFeatures,
// 	InitializeParams,
// 	DidChangeConfigurationNotification,
// 	CompletionItem,
// 	CompletionItemKind,
// 	TextDocumentPositionParams,
// 	TextDocumentSyncKind,
// 	InitializeResult
// } from 'vscode-languageserver/node';

// import {
// 	TextDocument
// } from 'vscode-languageserver-textdocument';

// // Create a connection for the server, using Node's IPC as a transport.
// // Also include all preview / proposed LSP features.
// const connection = createConnection(ProposedFeatures.all);

// // Create a simple text document manager.
// const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// let hasConfigurationCapability = false;
// let hasWorkspaceFolderCapability = false;
// let hasDiagnosticRelatedInformationCapability = false;

// connection.onInitialize((params: InitializeParams) => {
// 	const capabilities = params.capabilities;

// 	// Does the client support the `workspace/configuration` request?
// 	// If not, we fall back using global settings.
// 	hasConfigurationCapability = !!(
// 		capabilities.workspace && !!capabilities.workspace.configuration
// 	);
// 	hasWorkspaceFolderCapability = !!(
// 		capabilities.workspace && !!capabilities.workspace.workspaceFolders
// 	);
// 	hasDiagnosticRelatedInformationCapability = !!(
// 		capabilities.textDocument &&
// 		capabilities.textDocument.publishDiagnostics &&
// 		capabilities.textDocument.publishDiagnostics.relatedInformation
// 	);

// 	const result: InitializeResult = {
// 		capabilities: {
// 			textDocumentSync: TextDocumentSyncKind.Incremental,
// 			// Tell the client that this server supports code completion.
// 			completionProvider: {
// 				resolveProvider: true
// 			}
// 		}
// 	};
// 	if (hasWorkspaceFolderCapability) {
// 		result.capabilities.workspace = {
// 			workspaceFolders: {
// 				supported: true
// 			}
// 		};
// 	}
// 	return result;
// });

// connection.onInitialized(() => {
// 	if (hasConfigurationCapability) {
// 		// Register for all configuration changes.
// 		connection.client.register(DidChangeConfigurationNotification.type, undefined);
// 	}
// 	if (hasWorkspaceFolderCapability) {
// 		connection.workspace.onDidChangeWorkspaceFolders(_event => {
// 			connection.console.log('Workspace folder change event received.');
// 		});
// 	}
// });

// // The example settings
// interface ExampleSettings {
// 	maxNumberOfProblems: number;
// }

// // The global settings, used when the `workspace/configuration` request is not supported by the client.
// // Please note that this is not the case when using this server with the client provided in this example
// // but could happen with other clients.
// const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
// let globalSettings: ExampleSettings = defaultSettings;

// // Cache the settings of all open documents
// const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

// connection.onDidChangeConfiguration(change => {
// 	if (hasConfigurationCapability) {
// 		// Reset all cached document settings
// 		documentSettings.clear();
// 	} else {
// 		globalSettings = <ExampleSettings>(
// 			(change.settings.parasailServer || defaultSettings)
// 		);
// 	}

// 	// Revalidate all open text documents
// 	documents.all().forEach(validateTextDocument);
// });

// function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
// 	if (!hasConfigurationCapability) {
// 		return Promise.resolve(globalSettings);
// 	}
// 	let result = documentSettings.get(resource);
// 	if (!result) {
// 		result = connection.workspace.getConfiguration({
// 			scopeUri: resource,
// 			section: 'parasailServer'
// 		});
// 		documentSettings.set(resource, result);
// 	}
// 	return result;
// }

// // Only keep settings for open documents
// documents.onDidClose(e => {
// 	documentSettings.delete(e.document.uri);
// });

// // The content of a text document has changed. This event is emitted
// // when the text document first opened or when its content has changed.
// documents.onDidChangeContent(change => {
// 	validateTextDocument(change.document);
// });

// async function validateTextDocument(textDocument: TextDocument): Promise<void> {
// 	// In this simple example we get the settings for every validate run.
// 	const settings = await getDocumentSettings(textDocument.uri);

// 	// The validator creates diagnostics for all uppercase words length 2 and more
// 	const text = textDocument.getText();
// 	const pattern = /\b[A-Z]{2,}\b/g;
// 	let m: RegExpExecArray | null;

// 	let problems = 0;
// 	const diagnostics: Diagnostic[] = [];
// 	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
// 		problems++;
// 		const diagnostic: Diagnostic = {
// 			severity: DiagnosticSeverity.Warning,
// 			range: {
// 				start: textDocument.positionAt(m.index),
// 				end: textDocument.positionAt(m.index + m[0].length)
// 			},
// 			message: `${m[0]} is all uppercase.`,
// 			source: 'ex'
// 		};
// 		if (hasDiagnosticRelatedInformationCapability) {
// 			diagnostic.relatedInformation = [
// 				{
// 					location: {
// 						uri: textDocument.uri,
// 						range: Object.assign({}, diagnostic.range)
// 					},
// 					message: 'Spelling matters'
// 				},
// 				{
// 					location: {
// 						uri: textDocument.uri,
// 						range: Object.assign({}, diagnostic.range)
// 					},
// 					message: 'Particularly for names'
// 				}
// 			];
// 		}
// 		diagnostics.push(diagnostic);
// 	}

// 	// Send the computed diagnostics to VSCode.
// 	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
// }

// connection.onDidChangeWatchedFiles(_change => {
// 	// Monitored files have change in VSCode
// 	connection.console.log('We received an file change event');
// });

// // This handler provides the initial list of the completion items.
// connection.onCompletion(
// 	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
// 		// The pass parameter contains the position of the text document in
// 		// which code complete got requested. For the example we ignore this
// 		// info and always provide the same completion items.
// 		return [
// 			{
// 				label: 'TypeScript',
// 				kind: CompletionItemKind.Text,
// 				data: 1
// 			},
// 			{
// 				label: 'JavaScript',
// 				kind: CompletionItemKind.Text,
// 				data: 2
// 			}
// 		];
// 	}
// );

// // This handler resolves additional information for the item selected in
// // the completion list.
// connection.onCompletionResolve(
// 	(item: CompletionItem): CompletionItem => {
// 		if (item.data === 1) {
// 			item.detail = 'TypeScript details';
// 			item.documentation = 'TypeScript documentation';
// 		} else if (item.data === 2) {
// 			item.detail = 'JavaScript details';
// 			item.documentation = 'JavaScript documentation';
// 		}
// 		return item;
// 	}
// );

// // Make the text document manager listen on the connection
// // for open, change and close text document events
// documents.listen(connection);

// // Listen on the connection
// connection.listen();

import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	Location,
	Hover
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as cp from 'child_process';
import * as path from 'path';

// Establish a connection for the server using Node's IPC transport with all proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Initialize a document manager to handle open text documents.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Capability flags to determine client feature support
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// Initialize server capabilities during connection setup
connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;
	// Check for various client capabilities
	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument && capabilities.textDocument.publishDiagnostics && capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	// Define server capabilities, including completion, hover, and definition support
	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			completionProvider: { resolveProvider: true },
			hoverProvider: true,
			definitionProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = { workspaceFolders: { supported: true } };
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for configuration changes after initialization
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
});

// Default settings used if client doesn't provide custom settings
const defaultSettings: { maxNumberOfProblems: number } = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;

// Cache settings for each open document
const documentSettings: Map<string, Thenable<typeof defaultSettings>> = new Map();

// Handle configuration changes from client
connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
		globalSettings = change.settings.languageServerExample || defaultSettings;
	}
	// Re-validate all open documents with new settings
	documents.all().forEach(validateTextDocument);
});

// Retrieve settings for a specific document
function getDocumentSettings(resource: string): Thenable<typeof defaultSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({ scopeUri: resource, section: 'languageServerExample' });
		documentSettings.set(resource, result);
	}
	return result;
}

// Remove cached settings when a document is closed
documents.onDidClose(e => documentSettings.delete(e.document.uri));

// Re-validate document content when changed
documents.onDidChangeContent(change => validateTextDocument(change.document));

// Core validation function to run diagnostics using `spawn`
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const settings = await getDocumentSettings(textDocument.uri);
	const diagnostics: Diagnostic[] = [];
	const sourceText = textDocument.getText();

	// Spawn a child process to execute the external `parasail_parser` and pass input via stdin
	const child = cp.spawn('parasail_parser');

	// Write the document content (sourceText) to the parser's stdin
	child.stdin.write(sourceText);
	child.stdin.end(); // Signal that input is complete

	// Capture and process stderr for diagnostic messages
	child.stderr.on('data', (data) => {
		const lines = data.toString().split('\n');
		// Parse each line from the parser output to create diagnostics
		lines.forEach((line: string) => {
			const match = /(\d+):(\d+):\s*(.*)/.exec(line);
			if (match) {
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
					range: {
						start: { line: parseInt(match[1]) - 1, character: parseInt(match[2]) - 1 },
						end: { line: parseInt(match[1]) - 1, character: parseInt(match[2]) }
					},
					message: match[3],
					source: 'parasail-parser'
				};
				diagnostics.push(diagnostic);
			}
		});
		// Send gathered diagnostics to the client after processing all output lines
		connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
	});

	// Handle any errors that occur when trying to spawn or communicate with the parser
	child.on('error', (error) => {
		console.error(`Error executing parser: ${error.message}`);
	});
}

// Provide autocompletion items for ParaSail-specific keywords
connection.onCompletion((_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
	return [
		{ label: 'function', kind: CompletionItemKind.Keyword },
		{ label: 'type', kind: CompletionItemKind.Keyword },
		{ label: 'end', kind: CompletionItemKind.Keyword }
	];
});

// Provide hover information for keywords like "function" and "type"
connection.onHover((params): Hover | null => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) {
		return null;
	}
	const word = getWordAtPosition(doc, params.position);
	if (word === 'function') {
		return { contents: { kind: 'markdown', value: '**function**: Defines a new function in ParaSail.' } };
	} else if (word === 'type') {
		return { contents: { kind: 'markdown', value: '**type**: Defines a new type in ParaSail.' } };
	}
	return null;
});

// Define a placeholder definition location for demonstration purposes
connection.onDefinition((params): Location => {
	return Location.create(params.textDocument.uri, {
		start: { line: 0, character: 0 },
		end: { line: 0, character: 1 }
	});
});

// Attach document manager to connection for document events
documents.listen(connection);
// Start listening on the connection for client interactions
connection.listen();

// Helper function to find the word at a specific position in a document
function getWordAtPosition(doc: TextDocument, pos: TextDocumentPositionParams['position']): string | undefined {
	const line = doc.getText({ start: { line: pos.line, character: 0 }, end: { line: pos.line + 1, character: 0 } });
	const regex = /\b\w+\b/g;
	let match;
	while ((match = regex.exec(line))) {
		const start = match.index;
		const end = start + match[0].length;
		if (pos.character >= start && pos.character <= end) return match[0];
	}
	return undefined;
}
