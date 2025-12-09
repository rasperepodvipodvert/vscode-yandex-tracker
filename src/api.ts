import { AxiosInstance } from 'axios';

interface CookieAuthData {
    iamToken: string;
    cloudOrgId: string;
    expiresAt: number;
}

export class Tracker {
    private _client: AxiosInstance;

    private host: string;

    private cookie: string;

    private frontByHost: Map<string, string>;

    private cookieAuthData: CookieAuthData | null = null;

    constructor(client: AxiosInstance, host: string, cookie: string) {
        this._client = client;
        this.host = host;
        this.cookie = cookie;
        this.frontByHost = new Map<string, string>([
            ['https://api.tracker.yandex.net/', 'https://tracker.yandex.ru'],
            ['https://st-api.test.yandex-team.ru/', 'https://st.test.yandex-team.ru'],
            ['https://st-api.yandex-team.ru/', 'https://st.yandex-team.ru'],
        ]);
    }

    private async fetchIamTokenFromCookies(): Promise<CookieAuthData> {
        const frontUrl = this.front();
        const response = await this._client.get(frontUrl, {
            headers: {
                'Cookie': this.cookie
            },
            maxRedirects: 5
        });

        const html = response.data as string;
        const match = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);
        if (!match) {
            throw new Error('Could not find __PRELOADED_STATE__ in response');
        }

        const preloadedState = JSON.parse(match[1]);
        const iamToken = preloadedState?.user?.iamToken;
        const cloudOrgId = preloadedState?.user?.organizationIds?.cloudOrgId;

        if (!iamToken) {
            throw new Error('Could not extract IAM token from cookies. Please re-login to Tracker in browser.');
        }

        return {
            iamToken,
            cloudOrgId: cloudOrgId || '',
            expiresAt: Date.now() + 10 * 60 * 1000 // Cache for 10 minutes
        };
    }

    private async getAuthData(): Promise<{ token: string; orgId: string }> {
        if (!this.cookieAuthData || Date.now() > this.cookieAuthData.expiresAt) {
            this.cookieAuthData = await this.fetchIamTokenFromCookies();
        }
        return {
            token: this.cookieAuthData.iamToken,
            orgId: this.cookieAuthData.cloudOrgId
        };
    }

    private async client(): Promise<AxiosInstance> {
        this._client.defaults.baseURL = `${this.host}v2`;

        const authData = await this.getAuthData();

        this._client.defaults.headers.common['Authorization'] = `Bearer ${authData.token}`;
        this._client.defaults.headers.common['X-Cloud-Org-Id'] = authData.orgId;
        delete this._client.defaults.headers.common['Cookie'];

        return this._client;
    }

    async issues(): Promise<Issues> {
        return new Issues(await this.client());
    }

    front(): string {
        if (!this.frontByHost.has(this.host)) {
            throw Error(`Front for host ${this.host} not found`);
        }
        return this.frontByHost.get(this.host) || '';
    }

    async me(): Promise<User> {
        const client = await this.client();
        const response = await client.get('/myself');
        let data: RawUser = response.data;
        return new User(client, data.uid);
    }

    async fetchAttachment(url: string): Promise<string> {
        const frontUrl = this.front();

        // Handle both relative and absolute URLs
        let fullUrl = url;
        if (url.startsWith('/')) {
            fullUrl = frontUrl + url;
        }

        try {
            const response = await this._client.get(fullUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'Cookie': this.cookie
                },
                maxRedirects: 5
            });

            const contentType = response.headers['content-type'] || 'image/png';
            const buffer = Buffer.from(response.data);

            // Check if response is actually an image (not HTML error page)
            const isHtml = contentType.includes('text/html') ||
                buffer.toString('utf8', 0, 100).includes('<!DOCTYPE') ||
                buffer.toString('utf8', 0, 100).includes('<html');

            if (isHtml) {
                console.error('Attachment returned HTML instead of image:', fullUrl);
                return '';
            }

            const base64 = buffer.toString('base64');
            return `data:${contentType};base64,${base64}`;
        } catch (error) {
            console.error('Failed to fetch attachment:', fullUrl, error);
            return '';
        }
    }

    async fetchAttachments(urls: string[]): Promise<Map<string, string>> {
        const result = new Map<string, string>();

        const promises = urls.map(async (url) => {
            const dataUrl = await this.fetchAttachment(url);
            if (dataUrl) {
                result.set(url, dataUrl);
            }
        });

        await Promise.all(promises);
        return result;
    }
}

export class User {
    private client: AxiosInstance;

    private uid: Number;

    constructor(client: AxiosInstance, uid: Number){
        this.client = client;
        this.uid = uid;
    }

    async raw(): Promise<RawUser> {
        const response = await this.client.get(`/users/${this.uid}`);
        return response.data;
    }
}

interface RawUser {
    display: string;
    email: string;
    firstName: string;
    lastName: string;
    login: string;
    uid: Number;
}

export interface RawIssue {
    approvmentStatus: string;
    commentWithExternalMessageCount: Number;
    commentWithoutExternalMessageCount: Number;
    createdAt: string;
    createdBy?: {
        display: string;
        id: string;
        self: string;
    };
    assignee?: {
        display: string;
        id: string;
        self: string;
    };
    followers?: Array<{
        display: string;
        id: string;
        self: string;
    }>;
    favorite: boolean;
    id: string;
    key: string;
    lastCommentUpdatedAt: string;
    priority: {
        display: string;
        id: string;
        key: string;
        self: string;
    };
    queue: {
        display: string;
        id: string;
        key: string;
        self: string;
    };
    self: string;
    status: {
        display: string;
        id: string;
        key: string;
        self: string;
    };
    statusStartTime: string;
    summary: string;
    description: string;
    type: {
        display: string;
        id: string;
        key: string;
        self: string;
    };
    updatedAt: string;
    updatedBy: {
        display: string;
        id: string;
        key: string;
    };
    version: Number;
    votes: Number;
}

export interface RawComment {
    self: string;
    id: string;
    text: string;
    createdBy: {
        display: string;
        id: string;
        self: string;
    };
    updatedBy: {
        display: string;
        id: string;
        key: string;
    };
    createdAt: string;
    updatedAt: string;
}

export class Issues {
    private client: AxiosInstance;

    constructor(client: AxiosInstance){
        this.client = client;
    }

    async * search(query: string): AsyncIterator<Issue> {
        let page = 1;
        const perPage = 50;
        while(true) {
            const response = await this.client.post(
                '/issues/_search',
                { query: query },
                {params: {page: page, perPage: perPage}}
            );
            yield * response.data.map((item: RawIssue) => {
                return new Issue(
                    this.client,
                    item.key,
                    item.summary,
                    item.priority?.key,
                    item.status?.key
                );
            });
            if (!response.headers.link.includes('rel="next"')){
                break;
            }
            page++;
        }
    }

    get(number: string): Issue {
        return new Issue(this.client, number);
    }
}

export class Issue {
    // @ts-ignore
    private client: AxiosInstance;
    private num: string;
    private dsc: string;
    private _priority: string;
    private _status: string;

    constructor(client: AxiosInstance, number: string, title: string = '', priority: string = '', status: string = '') {
        this.client = client;
        this.num = number;
        this.dsc = title;
        this._priority = priority;
        this._status = status;
    }

    number(): string {
        return this.num;
    }

    priority(): string {
        return this._priority;
    }

    status(): string {
        return this._status;
    }

    async description(): Promise<string> {
        return this.dsc === '' ? (await this.raw()).summary : this.dsc;
    }

    async raw(): Promise<RawIssue> {
        const response = await this.client.get(`/issues/${this.num}`);
        return response.data;
    }

    comments(): Comments {
        return new Comments(this.client, this.num);
    }
}

export class Comments {
    private client: AxiosInstance;
    private issueNumber: string;

    constructor(client: AxiosInstance, issueNumber: string) {
        this.client = client;
        this.issueNumber = issueNumber;
    }

    async all(): Promise<Comment[]> {
        const response = await this.client.get(`/issues/${this.issueNumber}/comments`);
        return response.data.map((item: RawComment) => {
            return new Comment(this.client, this.issueNumber, item.id, item);
        });
    }
}

export class Comment {
    private client: AxiosInstance;

    private issueNumber: string;

    private commentId: string;

    private rawComment: RawComment | undefined;

    constructor(client: AxiosInstance, issueNumber: string, commentId: string, raw?: RawComment) {
        this.client = client;
        this.issueNumber = issueNumber;
        this.commentId = commentId;
        this.rawComment = raw;
    }

    async raw(): Promise<RawComment> {
        if(this.rawComment !== undefined) {
            return Promise.resolve(this.rawComment);
        }
        const response = await this.client.get(`/issues/${this.issueNumber}/comments/${this.commentId}`);
        return response.data;
    }
}
