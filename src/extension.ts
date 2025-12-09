import * as vscode from 'vscode';

import { Credentials } from './credentials';
import { IssuesProvider } from './views/issuesTree';
import { Tracker } from './api';
import { IssuePanel } from './views/issuePanel';
import { Resource } from './resource';

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
    const assignToMeView = new IssuesProvider(tracker, resource, 'Resolution: empty() and Assignee: me()');
    const followedByMe = new IssuesProvider(tracker, resource, 'Resolution: empty() and Followers: me()');
    const custom = new IssuesProvider(tracker, resource, customQuery);

    vscode.window.registerTreeDataProvider('assigned-to-me', assignToMeView);
    vscode.window.registerTreeDataProvider('followed-by-me', followedByMe);
    vscode.window.registerTreeDataProvider('custom', custom);

    vscode.commands.registerCommand(`${extensionId}.refreshAssignToMeView`, () => assignToMeView.refresh());
    vscode.commands.registerCommand(`${extensionId}.refreshFollowedByMeView`, () => followedByMe.refresh());
    vscode.commands.registerCommand(`${extensionId}.refreshCustomView`, () => custom.refresh());

    vscode.commands.registerCommand(`${extensionId}.moreAssignToMeView`, () => assignToMeView.loadMore());
    vscode.commands.registerCommand(`${extensionId}.moreFollowedByMeView`, () => followedByMe.loadMore());
    vscode.commands.registerCommand(`${extensionId}.moreCustomView`, () => custom.loadMore());

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
