import { endGroup, startGroup } from '@actions/core'
import * as github from '@actions/github'
import axios from 'axios'
import { formatEvent } from './format'
import { getInputs, Inputs, statusOpts } from './input'
import { logDebug, logError, logInfo } from './utils'
import { fitContent, fitEmbed } from './validate'

async function run() {
    try {
        logInfo('Getting inputs...')
        const inputs = getInputs()

        logInfo('Generating payload...')
        const payload = getPayload(inputs)
        startGroup('Dump payload')
        logInfo(JSON.stringify(payload, null, 2))
        endGroup()

        logInfo(`Triggering ${inputs.webhooks.length} webhook${inputs.webhooks.length > 1 ? 's' : ''}...`)
        await Promise.all(inputs.webhooks.map(w => wrapWebhook(w.trim(), payload)))
    } catch (e: any) {
        logError(`Unexpected failure: ${e} (${e.message})`)
    }
}

function wrapWebhook(webhook: string, payload: Object): Promise<void> {
    return async function () {
        try {
            await axios.post(webhook, payload)
        } catch (e: any) {
            if (e.response) {
                logError(`Webhook response: ${e.response.status}: ${JSON.stringify(e.response.data)}`)
            } else {
                logError(e)
            }
        }
    }()
}

export function getPayload(inputs: Readonly<Inputs>): Object {
    const ctx = github.context
    const { owner, repo } = ctx.repo
    const { eventName, ref, workflow, actor, payload, serverUrl, runId } = ctx
    const repoURL = `${serverUrl}/${owner}/${repo}`
    const workflowURL = `${repoURL}/actions/runs/${runId}`

    logDebug(JSON.stringify(payload))

    const eventFieldTitle = `Event - ${eventName}`
    const eventDetail = formatEvent(eventName, payload)

    let embed: { [key: string]: any } = {
        color: inputs.color || statusOpts[inputs.status].color
    }

    if (!inputs.notimestamp) {
        embed.timestamp = (new Date()).toISOString()
    }

    // title
    if (inputs.title) {
        embed.title = inputs.title
    }

    if (inputs.url) {
        embed.url = inputs.url
    }

    if (inputs.image) {
        embed.image = {
            url: inputs.image
        }
    }

    if (!inputs.noprefix) {
        embed.title = statusOpts[inputs.status].status + (embed.title ? `: ${embed.title}` : '')
    }

    if (inputs.description) {
        embed.description = inputs.description
    }

    if (!inputs.nocontext) {
        embed.fields = [
            {
                name: "Commits",
                value: eventDetail,
                inline: false
            }
        ]
    }

    let discord_payload: any = {
        embeds: [fitEmbed(embed)]
    }
    logDebug(`embed: ${JSON.stringify(embed)}`)

    if (inputs.username) {
        discord_payload.username = inputs.username
    }
    if (inputs.avatar_url) {
        discord_payload.avatar_url = inputs.avatar_url
    }
    if (inputs.content) {
        discord_payload.content = fitContent(inputs.content)
    }

    return discord_payload
}

run()
