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
import * as os from 'os';
import * as fs from 'fs';

// Establish a connection for the server using Node's IPC transport with all proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Initialize a document manager to handle open text documents.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// ParaSail keyword definitions for hover and completion
const parasailKeywords: { [key: string]: string } = {
	"func": "Defines a new function in ParaSail.",
	"type": "Defines a new type alias in ParaSail.",
	"end": "Marks the end of a block or declaration.",
	"interface": "Defines a module interface.",
	"class": "Defines a type and its operations.",
	"operator": "Defines an operator overload."
};

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

	// Define server capabilities
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
		// Register for configuration changes
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
});

// Default settings
const defaultSettings: { maxNumberOfProblems: number } = { maxNumberOfProblems: 1000 };
let globalSettings = defaultSettings;

// Document settings cache
const documentSettings: Map<string, Thenable<typeof defaultSettings>> = new Map();

// Handle configuration changes
connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		documentSettings.clear();
	} else {
		globalSettings = change.settings.parasailServer || defaultSettings;
	}
	documents.all().forEach(validateTextDocument);
});

// Retrieve document settings
function getDocumentSettings(resource: string): Thenable<typeof defaultSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({ scopeUri: resource, section: 'parasailServer' });
		documentSettings.set(resource, result);
	}
	return result;
}

// Clean up document settings on close
documents.onDidClose(e => documentSettings.delete(e.document.uri));

// Validate documents on change
documents.onDidChangeContent(change => validateTextDocument(change.document));

// Core validation with ParaSail interpreter
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	const settings = await getDocumentSettings(textDocument.uri);
	const diagnostics: Diagnostic[] = [];
	const sourceText = textDocument.getText();

	try {
		// Create temporary input file
		const tempFile = path.join(os.tmpdir(), `parasail-${Date.now()}-${Math.random().toString(36).slice(2)}.psi`);
		fs.writeFileSync(tempFile, sourceText);

		// Execute ParaSail interpreter with temp file
		const child = cp.spawn('interp.csh', [tempFile]);

		// Process diagnostic output
		child.stderr.on('data', (data) => {
			const lines = data.toString().split('\n');
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
						source: 'parasail'
					};
					diagnostics.push(diagnostic);
				}
			});
			connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
		});

		// Cleanup temp file after processing
		child.on('exit', () => {
			try {
				fs.unlinkSync(tempFile);
			} catch (err) {
				console.error(`Error cleaning up temp file: ${err}`);
			}
		});

		child.on('error', (error) => {
			console.error(`Interpreter error: ${error.message}`);
		});
	} catch (err) {
		console.error(`File handling error: ${err}`);
	}
}

// Auto-completion for keywords
connection.onCompletion((): CompletionItem[] => {
	return Object.keys(parasailKeywords).map(label => ({
		label,
		kind: CompletionItemKind.Keyword
	}));
});

// Hover information for keywords
connection.onHover((params): Hover | null => {
	const doc = documents.get(params.textDocument.uri);
	if (!doc) return null;
	
	const word = getWordAtPosition(doc, params.position);
	if (word && parasailKeywords[word]) {
		return {
			contents: {
				kind: 'markdown',
				value: `**${word}**: ${parasailKeywords[word]}`
			}
		};
	}
	return null;
});

// Definition provider placeholder
connection.onDefinition((params): Location => {
	return Location.create(params.textDocument.uri, {
		start: { line: 0, character: 0 },
		end: { line: 0, character: 1 }
	});
});

// Document manager setup
documents.listen(connection);
connection.listen();

// Word position helper
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