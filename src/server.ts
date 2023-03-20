import http from 'http'
import * as net from 'net'
import * as core from './core'
import * as mongo from 'mongodb'
import config from './config'

// This little helper function will help us with exhaustiveness type checking
function assertNever(x: never): never {
    throw new Error('Unexpected object: ' + x)
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

function writeText(res: http.ServerResponse, text: string) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(text)
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

export function startServer(
    log: core.Logger,
    db: core.BusinessRepository
): StartedServer {
    const coreOps = new core.Operations(db, log)

    // getBusinessHandler will try to get a business by id. If the id is invalid, it will return a 400 error.
    async function getBusinessHandler(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        businessId: string
    ) {
        const result = await db.getBusiness(businessId)
        if (result.type === 'record_not_found') {
            writeNotFoundError(res, new Error(`Business with id ${businessId} not found`))
            return
        }

        if (result.type === 'database_error') {
            log('error', result.error.message)
            writeError(res, new Error('Database error happened'))
            return
        }
        
        if (result.type === 'success') {
            const business = result.value
            writeJson(res, business)
            return
        }

        assertNever(result)
    }

    async function postReviewHandler(
        req: http.IncomingMessage,
        res: http.ServerResponse,
        businessId: string
    ) {
        const jsonData = await parseJson(req)
        const parseResult = core.createReviewInput.safeParse(jsonData)
        if (!parseResult.success) {
            writeError(res, new Error('Invalid data'))
            return
        }

        const result = await coreOps.createReview(businessId, parseResult.data)
        if (result instanceof Error) {
            writeError(res, result)
            return
        }

        writeText(res, '')
    }

    async function mainHandler(
        req: http.IncomingMessage,
        res: http.ServerResponse
    ) {
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
