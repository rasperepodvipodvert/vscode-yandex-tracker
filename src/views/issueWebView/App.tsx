import { Component } from 'preact';
import { marked } from 'marked';
import { RawIssue, RawComment } from '../../api';

export interface State {
    issue: RawIssue | null;
    front: string;
    comments: RawComment[];
    attachments: Record<string, string>;
}

interface Message {
    command: string;
    args: {
        issue: RawIssue;
        front: string;
        comments: RawComment[];
        attachments: Record<string, string>;
    };
}

// Priority colors
const priorityColors: Record<string, string> = {
    'blocker': '#ff4444',
    'critical': '#ff8800',
    'normal': '#4488ff',
    'minor': '#88aa00',
    'trivial': '#888888'
};

// Status colors
const statusColors: Record<string, string> = {
    'open': '#4488ff',
    'inProgress': '#ff8800',
    'needInfo': '#aa44ff',
    'resolved': '#44aa44',
    'closed': '#888888',
    'testing': '#44aaaa'
};

function renderMarkdown(text: string | undefined, baseUrl: string, attachments: Record<string, string>): string {
    if (!text) return '';
    try {
        // Fix Yandex Tracker image syntax: ![alt](/url =WxH) -> proper image with base64 data
        let processedText = text.replace(
            /!\[([^\]]*)\]\(([^)\s]+)(?:\s*=[^)]+)?\)/g,
            (match, alt, url) => {
                // Check if we have a base64 version of this image
                if (attachments[url]) {
                    return `![${alt}](${attachments[url]})`;
                }
                // Convert relative URL to absolute for fallback link
                let fullUrl = url;
                if (url.startsWith('/')) {
                    fullUrl = baseUrl + url;
                }
                const displayName = alt || 'image';
                return `[📎 ${displayName}](${fullUrl})`;
            }
        );

        // Also fix any remaining relative URLs in links
        processedText = processedText.replace(
            /\[([^\]]+)\]\((\/[^)]+)\)/g,
            (match, linkText, url) => `[${linkText}](${baseUrl}${url})`
        );

        return marked.parse(processedText, { async: false }) as string;
    } catch {
        return text;
    }
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getPriorityColor(key: string): string {
    return priorityColors[key.toLowerCase()] || '#4488ff';
}

function getStatusColor(key: string): string {
    return statusColors[key.toLowerCase()] || '#4488ff';
}

class App extends Component<object, State> {
    constructor() {
        super();
        this.receiveExtensionMessage = this.receiveExtensionMessage.bind(this);
        this.state = {
            issue: null,
            front: '',
            comments: [],
            attachments: {}
        };
    }

    componentDidMount() {
        window.addEventListener('message', this.receiveExtensionMessage);
    }

    receiveExtensionMessage(event: MessageEvent) {
        const message: Message = event.data;

        switch (message.command) {
            case 'issue': {
                this.setState({
                    issue: message.args.issue,
                    front: message.args.front,
                    comments: message.args.comments,
                    attachments: message.args.attachments || {}
                });
                break;
            }
            default:
                break;
        }
    }

    public render() {
        const { issue, front, comments, attachments } = this.state;
        if (!issue) {
            return <div className="Loading">Loading...</div>;
        }

        return (
            <div className="Issue">
                <div className="Main">
                    <div className="Header">
                        <a className="IssueKey" href={`${front}/${issue.key}`} target="_blank" rel="noopener">
                            {issue.key}
                        </a>
                        <span
                            className="StatusBadge"
                            style={{ backgroundColor: getStatusColor(issue.status.key) }}
                        >
                            {issue.status.display}
                        </span>
                    </div>

                    <h1 className="Summary">{issue.summary}</h1>

                    <div className="MetaRow">
                        <span className="MetaItem">
                            <span className="MetaLabel">Created:</span> {formatDate(issue.createdAt)}
                        </span>
                        <span className="MetaItem">
                            <span className="MetaLabel">Updated:</span> {formatDate(issue.updatedAt)}
                        </span>
                    </div>

                    <div className="Section">
                        <h2 className="SectionTitle">Description</h2>
                        <div
                            className="Description markdown-body"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(issue.description, front, attachments) }}
                        />
                    </div>

                    {comments.length > 0 && (
                        <div className="Section">
                            <h2 className="SectionTitle">Comments ({comments.length})</h2>
                            <div className="Comments">
                                {comments.map((cmt) => (
                                    <div className="Comment" key={cmt.id}>
                                        <div className="CommentHeader">
                                            <span className="CommentAuthor">
                                                {cmt.createdBy ? cmt.createdBy.display : 'Unknown'}
                                            </span>
                                            <span className="CommentDate">
                                                {formatDate(cmt.createdAt)}
                                            </span>
                                        </div>
                                        <div
                                            className="CommentBody markdown-body"
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(cmt.text, front, attachments) }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="Sidebar">
                    <div className="SidebarSection">
                        <div className="SidebarItem">
                            <span className="SidebarLabel">Type</span>
                            <span className="SidebarValue">{issue.type.display}</span>
                        </div>
                        <div className="SidebarItem">
                            <span className="SidebarLabel">Priority</span>
                            <span className="SidebarValue">
                                <span
                                    className="PriorityDot"
                                    style={{ backgroundColor: getPriorityColor(issue.priority.key) }}
                                />
                                {issue.priority.display}
                            </span>
                        </div>
                        <div className="SidebarItem">
                            <span className="SidebarLabel">Status</span>
                            <span
                                className="StatusBadge small"
                                style={{ backgroundColor: getStatusColor(issue.status.key) }}
                            >
                                {issue.status.display}
                            </span>
                        </div>
                    </div>

                    <div className="SidebarSection">
                        <div className="SidebarItem">
                            <span className="SidebarLabel">Assignee</span>
                            <span className="SidebarValue PersonValue">
                                {issue.assignee ? issue.assignee.display : '—'}
                            </span>
                        </div>
                        <div className="SidebarItem">
                            <span className="SidebarLabel">Author</span>
                            <span className="SidebarValue PersonValue">
                                {issue.createdBy ? issue.createdBy.display : '—'}
                            </span>
                        </div>
                        {issue.followers && issue.followers.length > 0 && (
                            <div className="SidebarItem">
                                <span className="SidebarLabel">Followers</span>
                                <div className="FollowersList">
                                    {issue.followers.map((flr) => (
                                        <span className="PersonValue" key={flr.id}>{flr.display}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
