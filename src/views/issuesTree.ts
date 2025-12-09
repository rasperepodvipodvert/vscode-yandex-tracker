import * as vscode from 'vscode';
import { Tracker, Issue } from '../api';
import { Resource } from '../resource';

// Priority to color mapping
const priorityColors: Record<string, vscode.ThemeColor> = {
    'blocker': new vscode.ThemeColor('charts.red'),
    'critical': new vscode.ThemeColor('charts.orange'),
    'normal': new vscode.ThemeColor('charts.blue'),
    'minor': new vscode.ThemeColor('charts.green'),
    'trivial': new vscode.ThemeColor('charts.gray')
};

function getPriorityIcon(priority: string): vscode.ThemeIcon {
    const color = priorityColors[priority.toLowerCase()] || priorityColors['normal'];
    return new vscode.ThemeIcon('circle-filled', color);
}

export class IssuesProvider implements vscode.TreeDataProvider<IssueItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<IssueItem | undefined> = new vscode.EventEmitter<IssueItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<IssueItem | undefined> = this._onDidChangeTreeData.event;

    private tracker: Tracker;

    private resource: Resource;

    private query: string;

    private issues: AsyncIterator<Issue> | null = null;

    private nodes: Issue[];

    constructor(tracker: Tracker, resource: Resource, query: string) {
        this.tracker = tracker;
        this.resource = resource;
        this.query = query;
        this.nodes = [];
    }

    private async getIssuesIterator(): Promise<AsyncIterator<Issue>> {
        if (!this.issues) {
            const issuesApi = await this.tracker.issues();
            this.issues = issuesApi.search(this.query);
        }
        return this.issues;
    }

    refresh() {
        this.issues = null;
        this.nodes = [];
        this._onDidChangeTreeData.fire(undefined);
    }

    loadMore() {
        this._onDidChangeTreeData.fire(undefined);
    }

    async getChildren(element?: IssueItem): Promise<Issue[]> {
        const issues = await this.getIssuesIterator();
        let perPanel = 50;
        while(perPanel !== 0){
            const issue = await issues.next();
            if (issue === undefined || issue.done) {
                break;
            }
            this.nodes.push(issue.value);
            perPanel--;
        }
        return this.nodes;
    }

    async getTreeItem(element: Issue): Promise<vscode.TreeItem> {
        const priority = element.priority();
        return {
            id: element.number(),
            label: element.number(),
            description: await element.description(),
            tooltip: await element.description(),
            iconPath: priority ? getPriorityIcon(priority) : this.resource.icons.Tracker,
            command: {
                command: 'vscode-yandex-tracker.openIssue',
                title: 'Open Issue',
                arguments: [element.number()],
            }
        };
    }
}

export class IssueItem implements vscode.TreeItem {

}