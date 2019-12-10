import * as _ from 'lodash'
import * as assert from 'assert'
import * as mongodb from 'mongodb'
import * as RJSON from 'relaxed-json'

const config = {
    numDatabases: 192, // Number of databases to simulate
    numCollections: 128, // Number of collections to simulate
    frequencyScale: 1, // Increase frequency across all ops by this factor
    rampup: false, // Slowly ramp up load
    precreate: true, // Precreate databases and collections
    host: '127.0.0.1',
    port: '27017',
    reportIntervalMs: 1000, // Time between reports (0 to disable)
    ops: {
        insert: {
            opsPerInterval: 8, // Target number of inserts to perform at each interval
            concurrency: 512, // Maximum number of concurrent requests outstanding
            intervalMs: 100, // How often to operate (milliseconds)
            maxDocumentsPerOp: 10, // Maximum number of documents per insert
        },
        query: {
            opsPerInterval: 16,
            concurrency: 2048,
            intervalMs: 100,
        },
        update: {
            opsPerInterval: 16,
            concurrency: 512,
            intervalMs: 100,
        },
        replSetGetStatus: {
            opsPerInterval: 10,
            concurrency: 1024,
            intervalMs: 100,
        },
        serverStatus: {
            opsPerInterval: 2,
            concurrency: 64,
            intervalMs: 1000,
        },
    },
}

const context = {
    startTime: 0,
}

const initConfig = () => {
    const args = process.argv

    if (args.length > 2) {
        const json = args.slice(2).join(' ')
        const userConfig = RJSON.parse(json)

        Object.assign(config, userConfig)
    }

    console.log(JSON.stringify(config, null, 2))
}

const initContext = () => {
    context.startTime = Date.now()

    Object.keys(config.ops).forEach((op) => {
        context[op] = {
            init: 0,
            done: 0,
            time: 0,
            latency: 0,
            error: 0,
            skip: 0,
        }
    })
}

const getName = (dimension, i) => `${dimension}_${i}`

const selectDatabase = () =>
    getName('database', Math.floor(config.numDatabases * Math.random()))

const selectCollection = () =>
    getName('collection', Math.floor(config.numCollections * Math.random()))

const getRandomChar = () =>
    String.fromCharCode('a'.charCodeAt(0) + Math.floor(26 * Math.random()))

const generateDocument = () => ({
    [getRandomChar()]: Math.floor(100 * Math.random()),
})

/**
 * doOperation performs the specified mongo operation.
 *
 * Perhaps we should make a connection pool to use.
 *
 * @param opType Type of mongo operation (e.g. insert, query)
 * @param database Name of the database to operate on
 * @param collection Name of the collection to operate on
 */
const doOperation = async (client, opType, database, collection): Promise<void> => {
    const db = await client.db(database)
    const coll = await db.collection(collection)

    let res

    if (opType === 'insert') {
        // Randomized number of documents, from 1
        const numDocuments = Math.ceil(
            config.ops['insert'].maxDocumentsPerOp * Math.random())

        const documents = Array.from({ length: numDocuments }, generateDocument)

        res = await coll.insertMany(documents)

        assert.equal(numDocuments, res.result.n)
        assert.equal(numDocuments, res.ops.length)

    } else if (opType === 'query') {
        res = await coll.find(generateDocument()).toArray()

    } else if (opType === 'update') {
        res = await coll.updateOne(
            generateDocument(),
            { $set: generateDocument() },
        )

    } else if (opType === 'replSetGetStatus') {
        try {
            res = await db.admin().replSetGetStatus()
        } catch {}

    } else if (opType === 'serverStatus') {
        res = await db.admin().serverStatus()

    } else {
        throw Error(`Unknown operation "${opType}"`)
    }
}

const getNumOps = (opType) => {
    const targetOps = config.ops[opType].opsPerInterval

    if (!config.rampup) {
        return targetOps
    }

    const done = context[opType].done

    const RAMP_FACTOR = 5000
    const RAMP_SHAPE = 0.23

    // asymptotic curve that crosses zero and approaches targetOps
    const ops = (
        (
            -1 *
            RAMP_FACTOR /
            (
                done**RAMP_SHAPE + (RAMP_FACTOR / targetOps)
            )
        ) +
        targetOps
    )

    return ops
}

/**
 * doOperations initiates the operations of the specified type and returns
 * Promises so the caller can wait for completion.
 *
 * @param opType Type of mongo operation (e.g. insert, query)
 * @returns Promises to complete the mongo operations
 */
const doOperations = (client, opType): Promise<void>[] => {
    // Target number of operations, reduced by a ramp factor, with some
    // randomness, multiplied by two to reach the target ops specified by the
    // user
    const numOps = Math.floor(getNumOps(opType) * Math.random() * 2)

    return Array.from({ length: numOps }, async () => {
        const ctx = context[opType]
        const outstanding = ctx.init - ctx.done

        if (config.ops[opType].concurrency > outstanding) {
            const startTime = Date.now()

            ctx.init++

            const database = selectDatabase()
            const collection = selectCollection()

            try {
                await doOperation(client, opType, database, collection)
            } catch (err) {
                console.log(err)
                ctx.error++
            }

            ctx.done++
            ctx.time += Date.now() - startTime
            ctx.latency = Math.floor(ctx.time / ctx.done)
        } else {
            ctx.skip++
        }
    })
}

const createClient = async (opType) => {
    const label = `Client creation for ${opType}`
    console.time(label)

    const url = `mongodb://${config.host}:${config.port}`
    const poolSize = config.ops[opType] && config.ops[opType].concurrency

    const client = await mongodb.MongoClient.connect(
        url,
        {
            // http://mongodb.github.io/node-mongodb-native/3.3/reference/connecting/connection-settings/
            poolSize,
            bufferMaxEntries: 0,
        },
    )

    console.log(`Connected to mongo at "${url}" with pool size ${poolSize}`)
    console.timeEnd(label)

    return client
}

/**
 * Called on an interval to perform all mongo operations configured by the
 * user.
 */
const initOperations = async (opType) => {
    const client = await createClient(opType)

    return {
        handler: async () => await Promise.all(doOperations(client, opType)),
        interval: Math.ceil(config.ops[opType].intervalMs / config.frequencyScale),
    }
}

const report = () => {
    console.log(new Date(), `Elapsed: ${Math.floor((Date.now() - context.startTime) / 1000)} seconds`)
    console.log(JSON.stringify(context, null, 2))
}

const createCollections = async () => {
    console.log(`Creating ${config.numDatabases} databases with ${config.numCollections} collections`)
    console.time('createCollections')

    const client = await createClient('createCollections')

    for (let i = 0; i < config.numDatabases; i++) {
        const dbName = getName('database', i)
        const db = await client.db(dbName)

        for (let j = 0; j < config.numCollections; j++) {
            await db.createCollection(getName('collection', j))
        }
        console.log(`Created ${config.numCollections} collections in database ${dbName}`)
    }

    console.timeEnd('createCollections')
}

/**
 * Initializes operations at the user configured interval
 */
const init = async () => {
    initConfig()
    initContext()

    if (config.precreate) {
        await createCollections()
    }

    if (config.reportIntervalMs) {
        setInterval(report, config.reportIntervalMs)
    }

    const opTypes = Object.keys(config.ops)

    for await (const { handler, interval } of opTypes.map(initOperations)) {
        setInterval(handler, interval)
    }
}

init()