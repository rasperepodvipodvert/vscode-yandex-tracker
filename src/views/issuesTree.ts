import * as vscode from 'vscode';
import { Tracker, Issue } from '../api';
import { Resource } from '../resource';

// Sort options
export type SortBy = 'default' | 'status' | 'createdAt' | 'updatedAt' | 'priority';

// Priority to color mapping
const priorityColors: Record<string, vscode.ThemeColor> = {
    'blocker': new vscode.ThemeColor('charts.red'),
    'critical': new vscode.ThemeColor('charts.orange'),
    'normal': new vscode.ThemeColor('charts.blue'),
    'minor': new vscode.ThemeColor('charts.green'),
    'trivial': new vscode.ThemeColor('charts.gray')
};

// Priority order for sorting (lower = higher priority)
const priorityOrder: Record<string, number> = {
    'blocker': 0,
    'critical': 1,
    'normal': 2,
    'minor': 3,
    'trivial': 4
};

// Status order for sorting
const statusOrder: Record<string, number> = {
    'open': 0,
    'inprogress': 1,
    'needinfo': 2,
    'testing': 3,
    'resolved': 4,
    'closed': 5
};

function getPriorityIcon(priority: string): vscode.ThemeIcon {
    const color = priorityColors[priority.toLowerCase()] || priorityColors['normal'];
    return new vscode.ThemeIcon('circle-filled', color);
}

function sortIssues(issues: Issue[], sortBy: SortBy): Issue[] {
    if (sortBy === 'default') {
        return issues;
    }

    return [...issues].sort((a, b) => {
        switch (sortBy) {
            case 'priority': {
                const aPriority = priorityOrder[a.priority().toLowerCase()] ?? 2;
                const bPriority = priorityOrder[b.priority().toLowerCase()] ?? 2;
                return aPriority - bPriority;
            }
            case 'status': {
                const aStatus = statusOrder[a.status().toLowerCase()] ?? 5;
                const bStatus = statusOrder[b.status().toLowerCase()] ?? 5;
                return aStatus - bStatus;
            }
            case 'createdAt': {
                return new Date(b.createdAt()).getTime() - new Date(a.createdAt()).getTime();
            }
            case 'updatedAt': {
                return new Date(b.updatedAt()).getTime() - new Date(a.updatedAt()).getTime();
            }
            default:
                return 0;
        }
    });
}

export class IssuesProvider implements vscode.TreeDataProvider<IssueItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<IssueItem | undefined> = new vscode.EventEmitter<IssueItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<IssueItem | undefined> = this._onDidChangeTreeData.event;

    private tracker: Tracker;

    private resource: Resource;

    private query: string;

    private issues: AsyncIterator<Issue> | null = null;

    private nodes: Issue[];

    private sortBy: SortBy = 'default';

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

    setSortBy(sortBy: SortBy) {
        this.sortBy = sortBy;
        this._onDidChangeTreeData.fire(undefined);
    }

    getSortBy(): SortBy {
        return this.sortBy;
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
        return sortIssues(this.nodes, this.sortBy);
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