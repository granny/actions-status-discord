import { logDebug } from "./utils"
import {PushEvent} from '@octokit/webhooks-definitions/schema';
import {MAX_EMBED_FIELD_VALUE_LENGTH} from "./constants";

type Formatter = (payload: any) => string

const formatters: Record<string, Formatter> = {
    push: pushFormatter,
    pull_request: pullRequestFormatter,
    release: releaseFormatter,
}

export function formatEvent(event: string, payload: Object): string {
    logDebug(JSON.stringify(payload, null, 2))
    let msg: string = "No further information"
    if (event in formatters) {
        try {
            return formatters[event](payload) || msg
        } catch(e: any) {
            logDebug(`Failed to generate eventDetail for ${event}: ${e}\n${e.stack}`)
        }
    }

    return msg
}

function pushFormatter(payload: PushEvent): string {
    let output: string = "";
    for (const commit of payload.commits) {
        output += `[\`${commit.id.substring(0, 7)}\`](${commit.url}) ${commit.message}`;
    }

    return output.length > MAX_EMBED_FIELD_VALUE_LENGTH ? output.substring(0, MAX_EMBED_FIELD_VALUE_LENGTH - 3) + "..." : output;
}

function pullRequestFormatter(payload: any): string {
    return `[\`#${payload.pull_request.number}\`](${payload.pull_request.html_url}) ${payload.pull_request.title}`
}

function releaseFormatter(payload: any): string {
    const { name, body } = payload.release
    const nameText = name ? `**${name}**` : ''
    return `${nameText}${(nameText && body) ? "\n" : ""}${body || ""}`
}
