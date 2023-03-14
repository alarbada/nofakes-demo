import http from 'http'
import config from '../config.json'
import * as core from './core'

// InMemStore is a simple in-memory store that implements the BusinessRepository interface.
export class InMemStore implements core.BusinessRepository {
    private businesses: core.Business[] = []
    private nextId = 0

    async createOnlineBusiness(data: core.CreateOnlineBusinessInput): Promise<core.OnlineBusiness | Error> {
        this.nextId += 1

        const business: core.OnlineBusiness = {
            id: this.nextId.toString(),
            name: data.name,
            website: data.website,
            email: data.email,
            total_reviews: 0
        }
        this.businesses.push(business)

        return business
    }

    async createPhysicalBusiness(data: core.CreatePhysicalBusinessInput): Promise<core.PhysicalBusiness | Error> {
        this.nextId += 1

        const business: core.PhysicalBusiness = {
            id: this.nextId.toString(),
            name: data.name,
            address: data.address,
            phone: data.phone,
            email: data.email,
            total_reviews: 0
        }
        this.businesses.push(business)

        return business
    }

    async getBusiness(id: string): Promise<core.OnlineBusiness | core.PhysicalBusiness | Error> {
        const business = this.businesses.find(b => b.id === id)
        if (!business) return new Error(`No business with id ${id}`)

        return business
    }
}

function logger(lvl: core.LogLevels, msg: string) {
    console.log(`[${lvl}] ${msg}`)
}

function writeError(res: http.ServerResponse, err: Error) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end(err.message)
}

function writeJson(res: http.ServerResponse, json: any) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(json))
}

function writeText(res: http.ServerResponse, text: string) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(text)
}

function parseJson(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.once('data', chunk => {
            try {
                body += chunk.toString();
            } catch (err) {
                // just in case
                reject(err)
            }
        })
        req.once('end', () => {
            try {
                const data = JSON.parse(body);
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

export function startServer(log: core.Logger, db: core.BusinessRepository): { stop: () => Promise<void> } {
    const businessOps = new core.BusinessOperations(db, log)

    // getBusinessHandler will try to get a business by id. If the id is invalid, it will return a 400 error.
    async function getBusinessHandler(req: http.IncomingMessage, res: http.ServerResponse, id: string) {
        const result = await businessOps.getBusiness(id)

        // TODO: We need to distinguish between database errors and business not found errors,
        // so we can return a 404 in the latter case
        if (result instanceof Error) {
            writeError(res, result)
            return
        }

        writeJson(res, result)
        return
    }

    async function mainHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        const url = new URL(req.url!, `http://${req.headers.host}`)

        if (matchesPath(url, '/business')) {
            const id = getPathParam(url)
            if (req.method === 'GET' && id !== undefined) {
                await getBusinessHandler(req, res, id)
                return
            }
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end(`No route for ${req.method} ${req.url}`)
    }


    const server = http.createServer((req, res) => {
        mainHandler(req, res).catch(err => {
            log('error', err)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Internal server error')
        })
    })

    server.listen(config.port, () => {
        log('info', `Server running at http://localhost:${config.port}`)
    })

    function stopServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            server.close(err => {
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

