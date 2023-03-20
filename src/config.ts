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

export default {
    port: getEnv('SERVER_PORT'),
    mongo: {
        dbName: getEnv('MONGO_DATABASE'),
        user: getEnv('MONGO_USER'),
        password: getEnv('MONGO_PASSWORD'),
    },
}
