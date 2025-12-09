import * as vscode from 'vscode';

import { Credentials } from './credentials';
import { IssuesProvider, SortBy, GroupBy } from './views/issuesTree';
import { Tracker } from './api';
import { IssuePanel } from './views/issuePanel';
import { Resource } from './resource';
import { createBranchName } from './utils/transliterate';

import axios from 'axios';

export async function activate(context: vscode.ExtensionContext) {
    const extensionId = 'vscode-yandex-tracker';
    const config = vscode.workspace.getConfiguration(extensionId);
    const trackerHost = vscode.Uri.parse(config.get<string>('host') || '');
    const customQuery = config.get<string>('query') || '';
    const resource = new Resource(context);
    const credentials = new Credentials(context, trackerHost.authority);

    const cookie = await credentials.token();
    if (cookie === null) {
        vscode.window.showInformationMessage(`Set Cookie for host ${trackerHost.toString()}`, 'Setup Cookie').then((value) => {
            if (value) {
                vscode.commands.executeCommand(`${extensionId}.setCookie`);
            }
        });
    }
    const tracker = new Tracker(axios.create(), trackerHost.toString(), cookie || '');
    const issuePanel = new IssuePanel(context, tracker);
    const assignToMeView = new IssuesProvider(tracker, resource, 'Resolution: empty() and Assignee: me()', 'assigned-to-me', context.globalState);
    const followedByMe = new IssuesProvider(tracker, resource, 'Resolution: empty() and Followers: me()', 'followed-by-me', context.globalState);
    const custom = new IssuesProvider(tracker, resource, customQuery, 'custom', context.globalState);

    vscode.window.registerTreeDataProvider('assigned-to-me', assignToMeView);
    vscode.window.registerTreeDataProvider('followed-by-me', followedByMe);
    vscode.window.registerTreeDataProvider('custom', custom);

    vscode.commands.registerCommand(`${extensionId}.refreshAssignToMeView`, () => {
        assignToMeView.refresh();
        vscode.commands.executeCommand('setContext', 'yandexTracker.assignedToMe.collapsed', false);
    });
    vscode.commands.registerCommand(`${extensionId}.refreshFollowedByMeView`, () => {
        followedByMe.refresh();
        vscode.commands.executeCommand('setContext', 'yandexTracker.followedByMe.collapsed', false);
    });
    vscode.commands.registerCommand(`${extensionId}.refreshCustomView`, () => {
        custom.refresh();
        vscode.commands.executeCommand('setContext', 'yandexTracker.custom.collapsed', false);
    });

    vscode.commands.registerCommand(`${extensionId}.moreAssignToMeView`, () => assignToMeView.loadMore());
    vscode.commands.registerCommand(`${extensionId}.moreFollowedByMeView`, () => followedByMe.loadMore());
    vscode.commands.registerCommand(`${extensionId}.moreCustomView`, () => custom.loadMore());

    // Sort commands
    const showSortPicker = async (provider: IssuesProvider) => {
        const sortOptions: { label: string; value: SortBy; description?: string }[] = [
            { label: '$(list-ordered) Default', value: 'default', description: 'API order' },
            { label: '$(flame) Priority', value: 'priority', description: 'Blocker → Trivial' },
            { label: '$(pulse) Status', value: 'status', description: 'Open → Closed' },
            { label: '$(calendar) Created', value: 'createdAt', description: 'Newest first' },
            { label: '$(history) Updated', value: 'updatedAt', description: 'Recently updated first' }
        ];

        const currentSort = provider.getSortBy();
        const items = sortOptions.map(opt => ({
            ...opt,
            picked: opt.value === currentSort
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select sort order',
            title: 'Sort Issues'
        });

        if (selected) {
            provider.setSortBy(selected.value);
        }
    };

    vscode.commands.registerCommand(`${extensionId}.sortAssignToMeView`, () => showSortPicker(assignToMeView));
    vscode.commands.registerCommand(`${extensionId}.sortFollowedByMeView`, () => showSortPicker(followedByMe));
    vscode.commands.registerCommand(`${extensionId}.sortCustomView`, () => showSortPicker(custom));

    // Group commands
    const showGroupPicker = async (provider: IssuesProvider) => {
        const groupOptions: { label: string; value: GroupBy; description?: string }[] = [
            { label: '$(list-flat) No grouping', value: 'none', description: 'Flat list' },
            { label: '$(symbol-enum) Group by Status', value: 'status', description: 'Open, In Progress, etc.' },
            { label: '$(flame) Group by Priority', value: 'priority', description: 'Blocker, Critical, etc.' }
        ];

        const currentGroup = provider.getGroupBy();
        const items = groupOptions.map(opt => ({
            ...opt,
            picked: opt.value === currentGroup
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select grouping',
            title: 'Group Issues'
        });

        if (selected) {
            provider.setGroupBy(selected.value);
        }
    };

    vscode.commands.registerCommand(`${extensionId}.groupAssignToMeView`, () => showGroupPicker(assignToMeView));
    vscode.commands.registerCommand(`${extensionId}.groupFollowedByMeView`, () => showGroupPicker(followedByMe));
    vscode.commands.registerCommand(`${extensionId}.groupCustomView`, () => showGroupPicker(custom));

    // Collapse/Expand commands - use VS Code's native functionality with context tracking
    vscode.commands.executeCommand('setContext', 'yandexTracker.assignedToMe.collapsed', false);
    vscode.commands.executeCommand('setContext', 'yandexTracker.followedByMe.collapsed', false);
    vscode.commands.executeCommand('setContext', 'yandexTracker.custom.collapsed', false);

    vscode.commands.registerCommand(`${extensionId}.collapseAssignToMeView`, () => {
        vscode.commands.executeCommand('workbench.actions.treeView.assigned-to-me.collapseAll');
        vscode.commands.executeCommand('setContext', 'yandexTracker.assignedToMe.collapsed', true);
    });
    vscode.commands.registerCommand(`${extensionId}.expandAssignToMeView`, () => {
        assignToMeView.expandAll();
        vscode.commands.executeCommand('setContext', 'yandexTracker.assignedToMe.collapsed', false);
    });
    vscode.commands.registerCommand(`${extensionId}.collapseFollowedByMeView`, () => {
        vscode.commands.executeCommand('workbench.actions.treeView.followed-by-me.collapseAll');
        vscode.commands.executeCommand('setContext', 'yandexTracker.followedByMe.collapsed', true);
    });
    vscode.commands.registerCommand(`${extensionId}.expandFollowedByMeView`, () => {
        followedByMe.expandAll();
        vscode.commands.executeCommand('setContext', 'yandexTracker.followedByMe.collapsed', false);
    });
    vscode.commands.registerCommand(`${extensionId}.collapseCustomView`, () => {
        vscode.commands.executeCommand('workbench.actions.treeView.custom.collapseAll');
        vscode.commands.executeCommand('setContext', 'yandexTracker.custom.collapsed', true);
    });
    vscode.commands.registerCommand(`${extensionId}.expandCustomView`, () => {
        custom.expandAll();
        vscode.commands.executeCommand('setContext', 'yandexTracker.custom.collapsed', false);
    });

    vscode.commands.registerCommand(`${extensionId}.setCookie`, async () => {
        const cookieValue = await vscode.window.showInputBox({placeHolder: 'Set Cookie (Session_id=...;sessionid2=...;yandexuid=...)'});
        if(cookieValue === undefined || cookieValue === '') {
            vscode.window.showErrorMessage('Cookie can\'t be empty');
            return;
        }
        await credentials.save(cookieValue);
        vscode.window.showInformationMessage(`Cookie saved for host ${trackerHost.authority}`, 'Reload window').then((value) => {
            if (value) {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        });
    });
    vscode.commands.registerCommand(`${extensionId}.openIssue`, async (number: string | undefined) => {
        if (number === undefined) {
            number = await vscode.window.showInputBox({ placeHolder: 'Enter issue number' });
            if(number === undefined) {
                vscode.window.showErrorMessage('ID must\'t be empty');
                return;
            }
        }
        await tracker.me(); // check that credentials is valid
        issuePanel.show(number);
    });
    vscode.commands.registerCommand(`${extensionId}.createBranch`, async (arg: any) => {
        let issueKey: string;
        let summary: string;

        // Handle both Issue object (from context menu) and string (from command palette)
        if (arg && typeof arg.number === 'function') {
            // It's an Issue object from context menu
            issueKey = arg.number();
            summary = await arg.description();
        } else if (typeof arg === 'string') {
            issueKey = arg;
            const issues = await tracker.issues();
            const issue = issues.get(issueKey);
            summary = await issue.description();
        } else {
            const inputKey = await vscode.window.showInputBox({ placeHolder: 'Enter issue key (e.g., TASK-123)' });
            if (inputKey === undefined || inputKey === '') {
                vscode.window.showErrorMessage('Issue key is required');
                return;
            }
            issueKey = inputKey;
            const issues = await tracker.issues();
            const issue = issues.get(issueKey);
            summary = await issue.description();
        }

        try {
            const branchName = createBranchName(issueKey, summary);

            const gitExtension = vscode.extensions.getExtension('vscode.git');
            if (!gitExtension) {
                vscode.window.showErrorMessage('Git extension is not available');
                return;
            }

            const git = gitExtension.exports.getAPI(1);
            const repo = git.repositories[0];

            if (!repo) {
                vscode.window.showErrorMessage('No git repository found');
                return;
            }

            const confirmBranchName = await vscode.window.showInputBox({
                prompt: 'Branch name',
                value: branchName,
                placeHolder: 'Enter branch name'
            });

            if (confirmBranchName === undefined || confirmBranchName === '') {
                return;
            }

            await repo.createBranch(confirmBranchName, true);
            vscode.window.showInformationMessage(`Created and switched to branch: ${confirmBranchName}`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to create branch: ${error.message}`);
        }
    });
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(`${extensionId}`)) {
           vscode.window.showInformationMessage('Configuration changed', 'Reload window').then((value) => {
               if (value) {
                   vscode.commands.executeCommand('workbench.action.reloadWindow');
               }
           });
        }
    }));
}

export function deactivate() { }
