import * as vscode from 'vscode';
import { Tracker, Issue } from '../api';
import { Resource } from '../resource';

// Sort options
export type SortBy = 'default' | 'status' | 'createdAt' | 'updatedAt' | 'priority';

// Group options
export type GroupBy = 'none' | 'status' | 'priority';

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

// Status display names
const statusDisplayNames: Record<string, string> = {
    'open': 'Open',
    'inprogress': 'In Progress',
    'needinfo': 'Need Info',
    'testing': 'Testing',
    'resolved': 'Resolved',
    'closed': 'Closed'
};

// Priority display names
const priorityDisplayNames: Record<string, string> = {
    'blocker': 'Blocker',
    'critical': 'Critical',
    'normal': 'Normal',
    'minor': 'Minor',
    'trivial': 'Trivial'
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

// Group class for tree items
export class IssueGroup {
    constructor(
        public readonly key: string,
        public readonly label: string,
        public readonly icon: vscode.ThemeIcon,
        public readonly issues: Issue[]
    ) {}
}

type TreeElement = Issue | IssueGroup;

export class IssuesProvider implements vscode.TreeDataProvider<TreeElement> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeElement | undefined> = new vscode.EventEmitter<TreeElement | undefined>();
    readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined> = this._onDidChangeTreeData.event;

    private tracker: Tracker;

    private resource: Resource;

    private query: string;

    private viewId: string;

    private globalState: vscode.Memento;

    private issues: AsyncIterator<Issue> | null = null;

    private nodes: Issue[];

    private sortBy: SortBy = 'default';

    private groupBy: GroupBy = 'none';

    private expandVersion: number = 0;

    constructor(tracker: Tracker, resource: Resource, query: string, viewId: string, globalState: vscode.Memento) {
        this.tracker = tracker;
        this.resource = resource;
        this.query = query;
        this.viewId = viewId;
        this.globalState = globalState;
        this.nodes = [];

        // Restore saved state
        this.sortBy = globalState.get<SortBy>(`${viewId}.sortBy`, 'default');
        this.groupBy = globalState.get<GroupBy>(`${viewId}.groupBy`, 'none');
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
        this.globalState.update(`${this.viewId}.sortBy`, sortBy);
        this._onDidChangeTreeData.fire(undefined);
    }

    getSortBy(): SortBy {
        return this.sortBy;
    }

    setGroupBy(groupBy: GroupBy) {
        this.groupBy = groupBy;
        this.globalState.update(`${this.viewId}.groupBy`, groupBy);
        this._onDidChangeTreeData.fire(undefined);
    }

    getGroupBy(): GroupBy {
        return this.groupBy;
    }

    expandAll() {
        this.expandVersion++;
        this._onDidChangeTreeData.fire(undefined);
    }

    private groupIssuesByStatus(issues: Issue[]): IssueGroup[] {
        const groups = new Map<string, Issue[]>();

        for (const issue of issues) {
            const status = issue.status().toLowerCase();
            if (!groups.has(status)) {
                groups.set(status, []);
            }
            groups.get(status)!.push(issue);
        }

        // Sort groups by status order
        const sortedEntries = [...groups.entries()].sort((a, b) => {
            const aOrder = statusOrder[a[0]] ?? 99;
            const bOrder = statusOrder[b[0]] ?? 99;
            return aOrder - bOrder;
        });

        return sortedEntries.map(([status, issues]) => {
            const displayName = statusDisplayNames[status] || status;
            const icon = new vscode.ThemeIcon('circle-outline');
            return new IssueGroup(status, `${displayName} (${issues.length})`, icon, issues);
        });
    }

    private groupIssuesByPriority(issues: Issue[]): IssueGroup[] {
        const groups = new Map<string, Issue[]>();

        for (const issue of issues) {
            const priority = issue.priority().toLowerCase();
            if (!groups.has(priority)) {
                groups.set(priority, []);
            }
            groups.get(priority)!.push(issue);
        }

        // Sort groups by priority order
        const sortedEntries = [...groups.entries()].sort((a, b) => {
            const aOrder = priorityOrder[a[0]] ?? 99;
            const bOrder = priorityOrder[b[0]] ?? 99;
            return aOrder - bOrder;
        });

        return sortedEntries.map(([priority, issues]) => {
            const displayName = priorityDisplayNames[priority] || priority;
            const icon = getPriorityIcon(priority);
            return new IssueGroup(priority, `${displayName} (${issues.length})`, icon, issues);
        });
    }

    async getChildren(element?: TreeElement): Promise<TreeElement[]> {
        // If element is a group, return its issues
        if (element instanceof IssueGroup) {
            return sortIssues(element.issues, this.sortBy);
        }

        // Load issues if needed
        const iterator = await this.getIssuesIterator();
        let perPanel = 50;
        while (perPanel !== 0) {
            const issue = await iterator.next();
            if (issue === undefined || issue.done) {
                break;
            }
            this.nodes.push(issue.value);
            perPanel--;
        }

        // Return grouped or flat list
        if (this.groupBy === 'status') {
            return this.groupIssuesByStatus(this.nodes);
        } else if (this.groupBy === 'priority') {
            return this.groupIssuesByPriority(this.nodes);
        }

        return sortIssues(this.nodes, this.sortBy);
    }

    async getTreeItem(element: TreeElement): Promise<vscode.TreeItem> {
        if (element instanceof IssueGroup) {
            return {
                id: `group-${element.key}-v${this.expandVersion}`,
                label: element.label,
                iconPath: element.icon,
                collapsibleState: vscode.TreeItemCollapsibleState.Expanded
            };
        }

        const issue = element as Issue;
        const priority = issue.priority();
        return {
            id: issue.number(),
            label: issue.number(),
            description: await issue.description(),
            tooltip: await issue.description(),
            iconPath: priority ? getPriorityIcon(priority) : this.resource.icons.Tracker,
            collapsibleState: vscode.TreeItemCollapsibleState.None,
            command: {
                command: 'vscode-yandex-tracker.openIssue',
                title: 'Open Issue',
                arguments: [issue.number()],
            }
        };
    }
}

export class IssueItem implements vscode.TreeItem {

}
