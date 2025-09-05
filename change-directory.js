const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class TreeNode {
    constructor(label, fullPath, collapsibleState) {
        this.label = label;
        this.fullPath = fullPath;
        this.collapsibleState = collapsibleState;
        this.children = null; 
    }
}

class WorkspaceTreeProvider {
    constructor(rootPath) {
        this.rootPath = rootPath;
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
                ? { command: 'vscode.open', title: 'Open File', arguments: [vscode.Uri.file(element.fullPath)] }
                : undefined
        };
    }


    getChildren(element) {
        const dir = element ? element.fullPath : this.rootPath;
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir).map(name => {
            const fullPath = path.join(dir, name);
            const stat = fs.statSync(fullPath);
            return new TreeNode(
                name,
                fullPath,
                stat.isDirectory() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
            );
        });
    }

    findNodesByName(name, node = { fullPath: this.rootPath }) {
        let results = [];
        const children = this.getChildren(node);
        for (const child of children) {
            if (child.label.toLowerCase() === name.toLowerCase() && child.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                results.push(child);
            }
            if (child.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                results = results.concat(this.findNodesByName(name, child));
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

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const treeProvider = new WorkspaceTreeProvider(workspaceRoot);

    vscode.window.registerTreeDataProvider('workspaceExplorer', treeProvider);

    const disposable = vscode.commands.registerCommand('change-directory.expandFolder', async () => {
        const folderName = await vscode.window.showInputBox({ prompt: 'Enter folder name to expand' });
        if (!folderName) return;

        const matches = treeProvider.findNodesByName(folderName);

        if (matches.length === 0) {
            vscode.window.showErrorMessage(`Folder "${folderName}" not found`);
            return;
        }

        let nodeToReveal;

        if (matches.length === 1) {
            nodeToReveal = matches[0];
        } else {
            const pick = await vscode.window.showQuickPick(
                matches.map(m => ({ label: m.label, description: m.fullPath, node: m })),
                { placeHolder: 'Multiple folders found, pick one' }
            );
            if (!pick) return;
            nodeToReveal = pick.node;
        }

        vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(nodeToReveal.fullPath));


        treeProvider.refresh();
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
