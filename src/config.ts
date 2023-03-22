import dotenv from 'dotenv'

dotenv.config()

function getEnv(name: string): string {
    const value = process.env[name]
    if (value === undefined) {
        console.error(`Fatal error: Env var ${name} not found`)
        process.exit(1)
    }

    return value
}

// This prevents port conflicts when runnint the dev api server and the integration tests
let port = getEnv('SERVER_PORT')
if (process.env['NODE_ENV'] === 'test') {
    port += 1
}

export default {
    port,
    mongo: {
        dbName: getEnv('MONGO_DATABASE'),
        user: getEnv('MONGO_USER'),
        password: getEnv('MONGO_PASSWORD'),
    },
}
