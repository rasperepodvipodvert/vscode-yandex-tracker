import * as path from 'path';
import * as vscode from 'vscode';
import { Tracker, RawComment } from '../api';

// Extract image URLs from markdown text
function extractImageUrls(text: string | undefined): string[] {
    if (!text) return [];
    const urls: string[] = [];
    // Match Yandex Tracker image syntax: ![alt](/url) or ![alt](/url =WxH)
    const regex = /!\[[^\]]*\]\(([^)\s]+)(?:\s*=[^)]+)?\)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        urls.push(match[1]);
    }
    return urls;
}

export class IssuePanel {
    private context: vscode.ExtensionContext;

    private tracker: Tracker;

    private panel: vscode.WebviewPanel | null;

    private disposables: vscode.Disposable[];


    constructor(context: vscode.ExtensionContext, tracker: Tracker) {
        this.context = context;
        this.tracker = tracker;
        this.disposables = [];
        this.panel = null;
    }

    async show(ticketNumber: string) {
        const column = (vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined) || vscode.ViewColumn.One;
        if(!this.panel) {
            this.panel = vscode.window.createWebviewPanel(
                'react',
                ticketNumber,
                column,
                {
                    enableScripts: true,
                    localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'media'))]
                }
            );
            this.panel.webview.html = this.webviewHTML(this.panel.webview);
            this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        } else {
            this.panel.reveal(column);
            this.panel.title = ticketNumber;
        }
        const issuesApi = await this.tracker.issues();
        const issue = issuesApi.get(ticketNumber);
        const rawIssue = await issue.raw();
        const comments: RawComment[] = await Promise.all((await issue.comments().all()).map((c) => {return c.raw();}));

        // Extract all image URLs from issue description and comments
        const imageUrls: string[] = [
            ...extractImageUrls(rawIssue.description),
            ...comments.flatMap(c => extractImageUrls(c.text))
        ];

        console.log('Image URLs found:', imageUrls);
        console.log('Description:', rawIssue.description);
        comments.forEach((c, i) => console.log(`Comment ${i}:`, c.text));

        // Fetch all images and convert to base64
        const attachments = await this.tracker.fetchAttachments(imageUrls);
        console.log('Attachments loaded:', attachments.size);

        // Convert Map to plain object for JSON serialization
        const attachmentsObj: Record<string, string> = {};
        attachments.forEach((value, key) => {
            attachmentsObj[key] = value;
        });

        this.panel.webview.postMessage({
            command: 'issue',
            args: {
                issue: rawIssue,
                front: this.tracker.front(),
                comments: comments,
                attachments: attachmentsObj
            }
        });
    }

    private dispose() {
        if(this.panel === null) {
            return;
        }
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
        this.panel = null;
    }

    private webviewHTML(webview: vscode.Webview) {
        const scriptPathOnDisk = vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'index.js'));
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        const nonce = this.nonce();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
                <title>Issues</title>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline' http: https: data:;">
			</head>
			<body>
				<noscript>You need to enable JavaScript to run this app.</noscript>
				<div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
    }

    private nonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
