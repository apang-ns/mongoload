"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
exports.__esModule = true;
var _ = require("lodash");
var assert = require("assert");
var program = require("commander");
var pluralize = require("pluralize");
var mongodb = require("mongodb");
program
    .option('-d, --databases <integer>', 'Number of databases', 1000)
    .option('-c, --collections <integer>', 'Number of collections', 100)
    .option('-i, --interval <ms>', 'How often to operate (milliseconds)', 10)
    .option('-I, --inserts <integer>', 'Number of concurrent insertions', 10)
    .option('-Q, --queries <integer>', 'Number of concurrent queries', 10)
    .option('-D, --distribution <function>', 'Distribution of operations', 'random')
    .option('--maxDocuments <integer>', 'Maximum number of documents per insert', 10)
    .option('-h, --host <host>', 'Hostname', '127.0.0.1')
    .option('-p, --port <port>', 'Port', '27017')
    .option('-r, --report-interval <ms>', 'Time between reports (0 to disable)', 1000)
    .parse(process.argv);
var config = _.pick(program, [
    'databases',
    'collections',
    'interval',
    'inserts',
    'queries',
    'distribution',
    'maxDocuments',
    'host',
    'port',
    'reportInterval',
]);
var context = {
    client: null,
    lastReportTime: 0,
    stats: {
        pulses: 0,
        inserts: 0,
        queries: 0,
        errors: 0
    }
};
/**
 * Takes a dimension, such as database, and returns a name for an element within
 * the dimension. The size of the dimension is configured by the user.
 *
 * @param dimension What we are selecting (e.g. database, collection)
 */
var select = function (dimension) {
    // Get the size of the dimension from the configuration
    var size = config[pluralize.plural(dimension)];
    var selection = Math.floor(size * Math.random());
    assert(config.distribution === 'random', "Distribution function " + config.distribution + " is not supported");
    return dimension + "_" + selection;
};
var getRandomChar = function () {
    return String.fromCharCode('a'.charCodeAt(0) + Math.floor(26 * Math.random()));
};
var generateDocument = function () {
    var _a;
    return (_a = {},
        _a[getRandomChar()] = Math.floor(100 * Math.random()),
        _a);
};
/**
 * doOperation performs the specified mongo operation.
 *
 * Perhaps we should make a connection pool to use.
 *
 * @param opType Type of mongo operation (e.g. insert, query)
 * @param database Name of the database to operate on
 * @param collection Name of the collection to operate on
 */
var doOperation = function (opType, database, collection) { return __awaiter(_this, void 0, void 0, function () {
    var db, coll, numDocuments, documents, res;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, context.client.db(database)];
            case 1:
                db = _a.sent();
                return [4 /*yield*/, db.collection(collection)];
            case 2:
                coll = _a.sent();
                if (!(opType === 'insert')) return [3 /*break*/, 4];
                numDocuments = Math.floor(config.maxDocuments * Math.random()) + 1;
                documents = Array.from({ length: numDocuments }, generateDocument);
                return [4 /*yield*/, coll.insertMany(documents)];
            case 3:
                res = _a.sent();
                context.stats.inserts++;
                assert.equal(numDocuments, res.result.n);
                assert.equal(numDocuments, res.ops.length);
                return [3 /*break*/, 7];
            case 4:
                if (!(opType === 'query')) return [3 /*break*/, 6];
                return [4 /*yield*/, coll.find(generateDocument())];
            case 5:
                _a.sent();
                context.stats.queries++;
                return [3 /*break*/, 7];
            case 6: throw Error("Unknown operation " + opType);
            case 7: return [2 /*return*/];
        }
    });
}); };
/**
 * doOperations initiates the operations of the specified type and returns
 * Promises so the caller can wait for completion.
 *
 * @param opType Type of mongo operation (e.g. insert, query)
 * @returns Promises to complete the mongo operations
 */
var doOperations = function (opType) {
    var num = config[pluralize.plural(opType)];
    assert(num, "Operation type " + opType + " has no concurrency setting");
    return Array.from({ length: num }, function () { return __awaiter(_this, void 0, void 0, function () {
        var database, collection, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    database = select('database');
                    collection = select('collection');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, doOperation(opType, database, collection)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    context.stats.errors++;
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); });
};
/**
 * Called on an interval to perform all mongo operations configured by the
 * user.
 */
var operate = function () { return __awaiter(_this, void 0, void 0, function () {
    var now;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, Promise.all(doOperations('insert').concat(doOperations('query')))];
            case 1:
                _a.sent();
                context.stats.pulses++;
                now = Date.now();
                if (config.reportInterval &&
                    config.reportInterval + context.lastReportTime < now) {
                    context.lastReportTime = now;
                    console.log(context.stats);
                }
                return [2 /*return*/];
        }
    });
}); };
/**
 * Initializes operations at the user configured interval
 */
var init = function () { return __awaiter(_this, void 0, void 0, function () {
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                config.url = "mongodb://" + config.host + ":" + config.port;
                assert(config.interval, 'Operating interval must be set');
                console.log(config);
                _a = context;
                return [4 /*yield*/, mongodb.MongoClient.connect(config.url)];
            case 1:
                _a.client = _b.sent();
                console.log('Connected to mongo');
                setInterval(operate, config.interval);
                return [2 /*return*/];
        }
    });
}); };
init();
