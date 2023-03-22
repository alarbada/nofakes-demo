import http from 'http'
import * as net from 'net'
import { z } from 'zod'

import * as core from './core'
import config from './config'
import { assertNever } from './utils'
import { createMongoDbStore } from './mongodb_store'

// The default parseInt returns also NaN, which as the name tells, is not a number.
// But for some reason for typescirpt it IS a number. Let's better enforce this variant.
function safeParseInt(unparsed: string): number | undefined {
    const parsed = parseInt(unparsed)
    if (isNaN(parsed)) return undefined

    return parsed
}

function writeError(res: http.ServerResponse, err: Error) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end(err.message)
}

function writeNotFoundError(res: http.ServerResponse, err: Error) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end(err.message)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeJson(res: http.ServerResponse, json: { [key: string]: any }) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(json))
}

function parseJson(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let body = ''
        req.once('data', (chunk) => {
            try {
                body += chunk.toString()
            } catch (err) {
                // just in case
                reject(err)
            }
        })
        req.once('end', () => {
            try {
                const data = JSON.parse(body)
                resolve(data)
            } catch (error) {
                reject(error)
            }
        })
    })
}

// Tells whether a certain URL matches a path, like the following:
// url: /business
// path: '/business' => matches
//
// url: /business/1234
// path: '/business' => matches
//
// url: /reviews/1234/business
// path: '/business' => does not match
//
function matchesPath(url: URL, path: string): boolean {
    return url.pathname.slice(0, path.length) === path
}

// Get's the id from a path like the following:
// url: /business/1234 => 1234
// url: /business => undefined
function getPathParam(url: URL): string | undefined {
    const parts = url.pathname.split('/')
    const param = parts[parts.length - 1]
    return param
}

type StartedServer = {
    stop: () => Promise<void>
}

// CreateBusinessInput represents the necessary data to create either a physical
// or an online business
export type CreateBusinessInput =
    | {
          type: 'online'
          value: {
              name: string
              website: string
              email: string
          }
      }
    | {
          type: 'physical'
          value: {
              name: string
              address: string
              phone: string
              email: string
          }
      }

export async function createBusiness(
    input: CreateBusinessInput,
    db: core.BusinessRepository,
    log: core.Logger
): Promise<void | Error> {
    if (input.type === 'online') {
        const business = input.value
        if (business.name.length > 75) {
            return new Error(`Business name is too long`)
        }

        const result = await db.createOnlineBusiness(business)
        if (result.type === 'database_error') {
            return new Error(`Database error: ${result.error.message}`)
        }
        if (result.type === 'success') {
            log('info', `Created new business ${result.value.name}`)
            return
        }
        assertNever(result)
    } else if (input.type === 'physical') {
        const business = input.value
        if (business.name.length > 50) {
            return new Error(`Business name is too long`)
        }

        const result = await db.createPhysicalBusiness(business)
        if (result.type === 'database_error') {
            return new Error(`Database error: ${result.error.message}`)
        }

        if (result.type === 'success') {
            log('info', `Created new business ${result.value.name}`)
            return
        }

        assertNever(result)
    }

    assertNever(input)
}

export function startServer(
    log: core.Logger,
    db: core.BusinessRepository
): StartedServer {
    // getBusinessHandler will try to get a business by id. If the id is invalid, it will return a 400 error.
    async function getBusinessHandler(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        businessId: core.BusinessId
    ) {
        const result = await db.getBusiness(businessId)
        if (result.type === 'record_not_found') {
            writeNotFoundError(
                res,
                new Error(`Business with id ${businessId} not found`)
            )
            return
        }

        if (result.type === 'database_error') {
            log('error', result.error.message)
            writeError(res, new Error('Database error happened'))
            return
        }

        if (result.type === 'success') {
            const business = result.value

            // I prefer to reduce json nesting to keep things simple. The API consumers can tell
            // which type the business is just by looking at it's "type" property.
            writeJson(res, {
                type: business.type,
                ...business.value,
            })
            return
        }

        assertNever(result)
    }

    const postReviewJson = z.object({
        text: z.string(),
        rating: z.number(),
        username: z.string(),
    })

    async function postReviewHandler(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        businessId: core.BusinessId
    ): Promise<void> {
        const parsedBusinessId = safeParseInt(businessId)
        if (parsedBusinessId === undefined) {
            writeError(res, new Error('Invalid business id provided'))
            return
        }

        const jsonData = await parseJson(req)
        const parseResult = postReviewJson.safeParse(jsonData)
        if (!parseResult.success) {
            writeError(res, new Error('Invalid data format'))
            return
        }

        const input = parseResult.data

        if (input.text.length < 20) {
            writeError(res, new Error('Review text is too short'))
            return
        } else if (input.text.length > 500) {
            writeError(res, new Error('Review text is too long'))
            return
        }

        // Rating. Between 1 and 5. Without decimals.
        if (input.rating < 1 || input.rating > 5) {
            writeError(res, new Error('Rating is out of range'))
            return
        } else if (input.rating % 1 !== 0) {
            writeError(res, new Error('Rating must be an integer'))
            return
        }

        const reviewResult = await db.createReview(businessId, input)
        if (reviewResult.type === 'database_error') {
            writeError(
                res,
                new Error(`Database error: ${reviewResult.error.message}`)
            )
            return
        }

        if (reviewResult.type === 'success') {
            log('info', `Created new review for business ${businessId}`)
            res.writeHead(201)
            res.end()
            return
        }

        assertNever(reviewResult)
    }

    async function mainHandler(
        req: http.IncomingMessage,
        res: http.ServerResponse
    ): Promise<void> {
        if (req.url === undefined) throw new Error('no url found')

        const url = new URL(req.url, `http://${req.headers.host}`)

        // Regex pattern matching works for now, but I completely agree that is not the best way to do it.
        // Regexes are compiled for every single request, which is expensive.
        // The reason I went with regexes is because I wanted to keep the code with as
        // few dependencies as possible.

        if (matchesPath(url, '/business')) {
            // GET /business/:id
            if (
                req.method === 'GET' &&
                /\/business\/[a-zA-Z0-9]+$/.test(url.pathname)
            ) {
                const id = getPathParam(url)
                if (id) {
                    await getBusinessHandler(req, res, id)
                    return
                }
            }

            // POST /business/:id/reviews
            if (
                req.method === 'POST' &&
                /\/business\/[a-zA-Z0-9]+\/reviews$/.test(url.pathname)
            ) {
                const [, , id, ,] = url.pathname.split('/')
                if (id) {
                    await postReviewHandler(req, res, id)
                    return
                }
            }
        }

        writeNotFoundError(
            res,
            new Error(`No route for ${req.method} ${req.url}`)
        )
    }

    const server = http.createServer((req, res) => {
        mainHandler(req, res).catch((err) => {
            log('error', err)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Internal server error')
        })
    })

    server.listen(config.port, () => {
        log('info', `Server running at http://localhost:${config.port}`)
    })

    // This allows us to keep track of all incoming connections, so we can close them when the
    // server is stopped.
    const sockets = new Set<net.Socket>()
    server.on('connection', (socket) => {
        sockets.add(socket)
        socket.on('close', () => {
            sockets.delete(socket)
        })
    })

    function stopServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            // Destroy all sockets, so that we can gracefully close the server.
            // Note that the stop functionality is useful for use only for our integration tests.
            for (const socket of sockets) {
                socket.destroy()
            }

            server.close((err) => {
                if (err) {
                    reject(err)
                } else {
                    resolve()
                }
            })
        })
    }

    return { stop: stopServer }
}

const nodeEnv = process.env['NODE_ENV']

if (nodeEnv !== 'test') {
    const devLogger: core.Logger = (lvl, msg) => {
        console.log(`[${lvl}]: ${msg}`)
    }

    ;(async () => {
        const store = await createMongoDbStore()
        startServer(devLogger, store)
    })()
}
