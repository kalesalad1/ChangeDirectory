const vscode = require('vscode');
const path = require('path');

class TreeNode {
    constructor(label, uri, collapsibleState) {
        this.label = label;
        this.uri = uri; // Use URI instead of fullPath
        this.collapsibleState = collapsibleState;
        this.children = null;
    }
}

class WorkspaceTreeProvider {
    constructor(rootUri) {
        this.rootUri = rootUri;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element) {
        return {
            label: element.label,
            collapsibleState: element.collapsibleState,
            command: element.collapsibleState === vscode.TreeItemCollapsibleState.None
                ? { command: 'vscode.open', title: 'Open File', arguments: [element.uri] }
                : undefined
        };
    }

    async getChildren(element) {
        const uri = element ? element.uri : this.rootUri;
        try {
            const children = await vscode.workspace.fs.readDirectory(uri);
            return children.map(([name, fileType]) => {
                const childUri = vscode.Uri.joinPath(uri, name);
                const collapsibleState = fileType === vscode.FileType.Directory
                    ? vscode.TreeItemCollapsibleState.Collapsed
                    : vscode.TreeItemCollapsibleState.None;
                return new TreeNode(name, childUri, collapsibleState);
            });
        } catch (err) {
            console.error(err);
            return [];
        }
    }

    async findNodesByName(name, node = null) {
        const uri = node ? node.uri : this.rootUri;
        let results = [];
        const children = await this.getChildren(node);
        for (const child of children) {
            if (child.label.toLowerCase() === name.toLowerCase() &&
                child.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                results.push(child);
            }
            if (child.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                results = results.concat(await this.findNodesByName(name, child));
            }
        }
        return results;
    }
}

function activate(context) {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage("Please open a folder/workspace to use Workspace Explorer.");
        return;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri;
    const treeProvider = new WorkspaceTreeProvider(workspaceRoot);

    vscode.window.registerTreeDataProvider('workspaceExplorer', treeProvider);

    const disposable = vscode.commands.registerCommand('change-directory.expandFolder', async () => {
        const folderName = await vscode.window.showInputBox({ prompt: 'Enter folder name to expand' });
        if (!folderName) return;

        const matches = await treeProvider.findNodesByName(folderName);

        if (matches.length === 0) {
            vscode.window.showErrorMessage(`Folder "${folderName}" not found`);
            return;
        }

        let nodeToReveal;

        if (matches.length === 1) {
            nodeToReveal = matches[0];
        } else {
            const pick = await vscode.window.showQuickPick(
                matches.map(m => ({ label: m.label, description: m.uri.fsPath, node: m })),
                { placeHolder: 'Multiple folders found, pick one' }
            );
            if (!pick) return;
            nodeToReveal = pick.node;
        }

        vscode.commands.executeCommand('revealInExplorer', nodeToReveal.uri);
        treeProvider.refresh();
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
