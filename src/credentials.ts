import * as vscode from 'vscode';

const TOKEN_KEY = 'yandex-tracker-oauth-token';

export class Credentials {
    private secretStorage: vscode.SecretStorage;
    private host: string;

    constructor(context: vscode.ExtensionContext, host: string) {
        this.secretStorage = context.secrets;
        this.host = host;
    }

    private getKey(): string {
        return `${TOKEN_KEY}:${this.host}`;
    }

    async token(): Promise<string | null> {
        const token = await this.secretStorage.get(this.getKey());
        return token ?? null;
    }

    async save(token: string): Promise<void> {
        await this.secretStorage.store(this.getKey(), token);
    }

    async clean(): Promise<void> {
        await this.secretStorage.delete(this.getKey());
    }
}
