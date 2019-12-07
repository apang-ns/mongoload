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
    .option('-r, --rampup <integer>', 'Load ramp up to the specified iteration (0 to disable)', coerceInteger, 50000)
    .option('-b, --backoff <percentage>', 'Percentage of outstanding requests before backing off', coerceFloat, 0.1)
    .option('-I, --inserts <integer>', 'Target number of concurrent insertions', coerceInteger, 10)
    .option('-Q, --queries <integer>', 'Target number of concurrent queries', coerceInteger, 100)
    .option('-D, --distribution <function>', 'Distribution of operations', 'random')
    .option('--maxDocuments <integer>', 'Maximum number of documents per insert', coerceInteger, 10)
    .option('-h, --host <host>', 'Hostname', '127.0.0.1')
    .option('-p, --port <port>', 'Port', '27017')
    .option('-P, --pool-size <integer>', 'Mongo client connection pool size', coerceInteger, 100)
    .option('-R, --report-interval <ms>', 'Time between reports (0 to disable)', coerceInteger, 1000)
    .parse(process.argv)

const config = _.pick(
    program, 
    [
        'databases',
        'collections',
        'interval',
        'rampup',
        'backoff',
        'inserts',
        'queries',
        'distribution',
        'maxDocuments',
        'host',
        'port',
        'poolSize',
        'reportInterval',
    ]
)

const context = {
    client: null,
    startTime: 0,
    lastReportTime: 0,
    stats: {
        pulse: {
            init: 0,
            done: 0,
            time: 0,
            latency: 0,
            skip: 0,
        },
        ops: {
            insert: {
                init: 0,
                done: 0,
                time: 0,
                latency: 0,
                error: 0,
            },
            query: {
                init: 0,
                done: 0,
                time: 0,
                latency: 0,
                error: 0,
            },
        },
    }
}

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

    return `${dimension}_${selection}`
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
const doOperation = async (opType, database, collection): Promise<void> => {
    const db = await context.client.db(database)
    const coll = await db.collection(collection)

    if (opType === 'insert') {
        // Randomized number of documents, from 1
        const numDocuments = Math.ceil(config.maxDocuments * Math.random())

        const documents = Array.from({ length: numDocuments }, generateDocument)
 
        const res = await coll.insertMany(documents)

        assert.equal(numDocuments, res.result.n)
        assert.equal(numDocuments, res.ops.length)

    } else if (opType === 'query') {
        await coll.find(generateDocument())

    } else {
        throw Error(`Unknown operation "${opType}"`)
    }
}

const rampFactor = () => config.rampup > context.stats.pulse.done ?
    (context.stats.pulse.done / config.rampup) :
    1

/**
 * doOperations initiates the operations of the specified type and returns
 * Promises so the caller can wait for completion.
 * 
 * @param opType Type of mongo operation (e.g. insert, query)
 * @returns Promises to complete the mongo operations
 */
const doOperations = (opType): Promise<void>[] => {
    const targetOps = config[pluralize.plural(opType)]

    // Target number of operations, reduced by a ramp factor, with some
    // randomness, multiplied by two to reach the target ops specified by the
    // user
    const ops = Math.floor(targetOps * rampFactor() * Math.random() * 2)

    return Array.from({ length: ops }, async () => {
        const statObj = context.stats.ops[opType]
        const startTime = Date.now()

        statObj.init++        

        const database = select('database')
        const collection = select('collection')
    
        try {
            await doOperation(opType, database, collection)
        } catch (err) {
            statObj.errors++
        }

        statObj.done++
        statObj.time += Date.now() - startTime
        statObj.latency = Math.floor(statObj.time / statObj.done)
    })
}

/**
 * Called on an interval to perform all mongo operations configured by the
 * user.
 */
const operate = async (): Promise<void> => {
    const statObj = context.stats.pulse

    const startTime = Date.now()
    const outstanding = (statObj.init - statObj.done) / statObj.init
    const backoff = config.backoff * rampFactor()

    if (outstanding > backoff) {
        statObj.skip++

    } else {
        statObj.init++

        await Promise.all([
            ...doOperations('insert'),
            ...doOperations('query'),
        ])

        statObj.done++
        statObj.time += Date.now() - startTime
        statObj.latency = Math.floor(statObj.time / statObj.done)
    }

    if (config.reportInterval &&
        config.reportInterval + context.lastReportTime < Date.now()
    ) {
        context.lastReportTime = Date.now()

        console.log(new Date(), `Elapsed: ${Math.floor((Date.now() - context.startTime) / 1000)} seconds`)
        console.log(JSON.stringify(context.stats, null, 2))
    }
}

/**
 * Initializes operations at the user configured interval
 */
const init = async () => {
    assert(config.interval, 'Operating interval must be set')

    console.log(config)

    context.startTime = Date.now()

    context.client = await mongodb.MongoClient.connect(
        `mongodb://${config.host}:${config.port}`,
        {
        // http://mongodb.github.io/node-mongodb-native/3.3/reference/connecting/connection-settings/
        poolSize: config.poolSize,
        },
    )

    console.log(`Connected to mongo at "${config.url}"`)

    setInterval(operate, config.interval)
}

init()