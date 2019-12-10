import * as _ from 'lodash'
import * as assert from 'assert'
import * as program from 'commander'
import * as pluralize from 'pluralize'
import * as mongodb from 'mongodb'

const coerceInteger = (val, prev) => {
    const n = parseInt(val)

    assert(!isNaN(n), `Expected "${val}" to be an integer`)

    return n
}

const coerceFloat = (val, prev) => {
    const n = parseFloat(val)

    assert(!isNaN(n), `Expected "${val}" to be a float`)

    return n
}

program
    .option('-d, --databases <integer>', 'Number of databases', coerceInteger, 500)
    .option('-c, --collections <integer>', 'Number of collections', coerceInteger, 100)
    .option('-i, --interval <ms>', 'How often to operate (milliseconds)', coerceInteger, 100)
    .option('-c, --concurrency <integer>', 'Number of concurrent requests', coerceInteger, 256)
    .option('-r, --rampup', 'Ramp up load')
    .option('--no-precreate', 'Do not precreate databases and collections')
    .option('-I, --inserts <integer>', 'Target number of concurrent insertions', coerceInteger, 8)
    .option('-Q, --queries <integer>', 'Target number of concurrent queries', coerceInteger, 10)
    .option('-U, --updates <integer>', 'Target number of concurrent updates', coerceInteger, 16)
    .option('-C, --commands <integer>', 'Target number of concurrent commands', coerceInteger, 10)
    .option('-D, --distribution <function>', 'Distribution of operations', 'random')
    .option('--max-documents <integer>', 'Maximum number of documents per insert', coerceInteger, 10)
    .option('-h, --host <host>', 'Hostname', '127.0.0.1')
    .option('-p, --port <port>', 'Port', '27017')
    .option('-R, --report-interval <ms>', 'Time between reports (0 to disable)', coerceInteger, 1000)
    .parse(process.argv)

const config = _.pick(
    program,
    [
        'databases',
        'collections',
        'interval',
        'concurrency',
        'rampup',
        'precreate',
        'inserts',
        'queries',
        'updates',
        'commands',
        'distribution',
        'maxDocuments',
        'host',
        'port',
        'reportInterval',
    ]
)

const opContext = {
    init: 0,
    done: 0,
    time: 0,
    latency: 0,
    error: 0,
    skip: 0,
}

const context = {
    startTime: 0,
    insert: _.clone(opContext),
    query: _.clone(opContext),
    update: _.clone(opContext),
    command: _.clone(opContext),
}

const getName = (dimension, i) => `${dimension}_${i}`

/**
 * Takes a dimension, such as database, and returns a name for an element within
 * the dimension. The size of the dimension is configured by the user.
 *
 * @param dimension What we are selecting (e.g. database, collection)
 */
const select = (dimension) => {
    // Get the size of the dimension from the configuration
    const size = config[pluralize.plural(dimension)]
    const selection = Math.floor(size * Math.random())

    assert(
        config.distribution === 'random',
        `Distribution function "${config.distribution}" is not supported`,
    )

    return getName(dimension, selection)
}

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
        const numDocuments = Math.ceil(config.maxDocuments * Math.random())

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

    } else if (opType === 'command') {
        try {
            res = await db.admin().replSetGetStatus()
        } catch {}

    } else {
        throw Error(`Unknown operation "${opType}"`)
    }
}

const getNumOps = (opType) => {
    const targetOps = config[pluralize.plural(opType)]

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

        if (config.concurrency > outstanding) {
            const startTime = Date.now()

            ctx.init++

            const database = select('database')
            const collection = select('collection')

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

    const client = await mongodb.MongoClient.connect(
        url,
        {
            // http://mongodb.github.io/node-mongodb-native/3.3/reference/connecting/connection-settings/
            poolSize: config.concurrency,
            bufferMaxEntries: 0,
        },
    )

    console.log(`Connected to mongo at "${url}"`)
    console.timeEnd(label)

    return client
}

/**
 * Called on an interval to perform all mongo operations configured by the
 * user.
 */
const operate = async (opType) => {
    const client = await createClient(opType)

    return async () => await Promise.all(doOperations(client, opType))
}

const report = () => {
    console.log(new Date(), `Elapsed: ${Math.floor((Date.now() - context.startTime) / 1000)} seconds`)
    console.log(JSON.stringify(context, null, 2))
}

const createCollections = async () => {
    console.log(`Creating ${config.databases} databases with ${config.collections} collections`)
    console.time('createCollections')

    const client = await createClient('createCollections')

    for (let i = 0; i < config.databases; i++) {
        const dbName = getName('database', i)
        const db = await client.db(dbName)

        for (let j = 0; j < config.collections; j++) {
            await db.createCollection(getName('collection', j))
        }
        console.log(`Created ${config.collections} collections in database ${dbName}`)
    }

    console.timeEnd('createCollections')
}

/**
 * Initializes operations at the user configured interval
 */
const init = async () => {
    assert(config.interval, 'Operating interval must be set')

    console.log(config)

    context.startTime = Date.now()

    if (config.precreate) {
        await createCollections()
    }

    if (config.reportInterval) {
        setInterval(report, config.reportInterval)
    }

    for await (let handler of [
        'insert',
        'query',
        'update',
        'command',
    ].map(operate)) {
        setInterval(handler, config.interval)
    }
}

init()