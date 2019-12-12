import * as _ from 'lodash'
import * as assert from 'assert'
import * as mongodb from 'mongodb'
import * as RJSON from 'relaxed-json'

/**
 * Default configuration. These can be overwritten via the command line like
 * this:
 * npm start -- "{ frequencyScale: 2, ops: { insert: { opsPerInterval: 8 } } }"
 */
const config = {
    numDatabases: 128, // Number of databases to simulate
    numCollections: 128, // Number of collections to simulate
    frequencyScale: 1, // Increase frequency across all op types by this factor
    precreate: true, // Precreate databases and collections
    rampup: false, // Slowly ramp up load
    host: '127.0.0.1',
    port: '27017',
    reportIntervalMs: 1000, // Time between reports (0 to disable)
    ops: {
        insert: {
            opsPerInterval: 8, // Target number of inserts to perform at each interval
            concurrency: 512, // Maximum number of concurrent requests outstanding
            intervalMs: 100, // How often to operate (milliseconds)
            maxDocumentsPerOp: 5, // Maximum number of documents per insert
        },
        query: {
            opsPerInterval: 8,
            concurrency: 512,
            intervalMs: 100,
        },
        update: {
            opsPerInterval: 12,
            concurrency: 512,
            intervalMs: 100,
        },
        // replSetGetStatus: {
        //     opsPerInterval: 5,
        //     concurrency: 1024,
        //     intervalMs: 1000,
        // },
        // serverStatus: {
        //     opsPerInterval: 2,
        //     concurrency: 64,
        //     intervalMs: 1000,
        // },
    },
}

/**
 * Initialize configuration by merging user-provided config with defaults.
 */
const initConfig = () => {
    const args = process.argv

    if (args.length > 2) {
        const json = args.slice(2).join(' ')
        const userConfig = RJSON.parse(json)

        Object.assign(config, userConfig)
    }

    console.log(JSON.stringify(config, null, 2))
}

const context = {
    startTime: 0,
}

const initContext = () => {
    context.startTime = Date.now()

    // Initialize context per op type configured
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

// e.g. "database_1"
const getName = (dimension, i) => `${dimension}_${i}`

/**
 * Pick a random database and return its name
 */
const selectDatabase = () =>
    getName('database', Math.floor(config.numDatabases * Math.random()))

/**
 * Pick a random collection and return its name
 */
const selectCollection = () =>
    getName('collection', Math.floor(config.numCollections * Math.random()))

const getRandomChar = () => String.fromCharCode('a'.charCodeAt(0) + Math.floor(26 * Math.random()))

const getRandomNum = () => Math.floor(1000000 * Math.random())

const INDEXED_ATTRIBUTE = 'a'

const getIndexedAttribute = () => ({
    [INDEXED_ATTRIBUTE]: getRandomNum(),
})

const generateDocument = () => ({
    ...getIndexedAttribute(),
    [getRandomChar()]: getRandomNum(),
})

/**
 * doOperation performs the specified mongo operation.
 *
 * @param client Mongo client initialized once per operation type
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
        res = await coll.find(getIndexedAttribute()).toArray()

    } else if (opType === 'update') {
        res = await coll.updateOne(
            getIndexedAttribute(),
            { $set: generateDocument() },
        )

    } else if (opType === 'replSetGetStatus') {
        try {
            // This throws an exception for non-replicated setups. Ignore
            res = await db.admin().replSetGetStatus()
        } catch {}

    } else if (opType === 'serverStatus') {
        res = await db.admin().serverStatus()

    } else {
        throw Error(`Unknown operation "${opType}"`)
    }
}

/**
 * If rampup is not enabled, this function simply returns the configured
 * opsPerInterval.
 *
 * If rampup is enabled, it will return a reduced number of operations factored
 * by how many operations have already been performed.
 *
 * @param opType Type of operation (e.g. insert)
 */
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

        // If we are waiting for ops to return, and this number is more than
        // the configured concurrency for the operation type, skip.
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

/**
 * Create a client and connect with mongo. Configuration can be changed in
 * the command line.
 *
 * @param opType Type of operation this client is created for (e.g. insert)
 */
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
 * Initializes the operations object for the given operation type. Creates the
 * client connection once and makes it available to the returned operation
 * handler.
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

/**
 * Precreate all databases and collections.
 */
const createCollections = async () => {
    console.log(`Creating ${config.numDatabases} databases with ${config.numCollections} collections`)
    console.time('createCollections')

    const client = await createClient('createCollections')

    for (let i = 0; i < config.numDatabases; i++) {
        const dbName = getName('database', i)
        const db = await client.db(dbName)

        for (let j = 0; j < config.numCollections; j++) {
            const collectionName = getName('collection', j)
            await db.createCollection(collectionName)

            const coll = await db.collection(collectionName)
            await coll.createIndex({ [INDEXED_ATTRIBUTE]: 1 })
        }
        console.log(`Created ${config.numCollections} collections and indices in database ${dbName}`)
    }

    console.timeEnd('createCollections')
}

/**
 * Initializes configuration and context. Creates databases and collections if
 * configured. Sets intervals for reporting and performing operations.
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

    // Create a timer for each operation type
    for await (const { handler, interval } of opTypes.map(initOperations)) {
        setInterval(handler, interval)
    }
}

init()