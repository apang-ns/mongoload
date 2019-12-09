# mongoload

Setup

Docker with 8 cores and 16GB of memory.
Node and Typescript installed.

Operation

apang-mbp:~ andypang$ docker run -p 27017:27017 --rm --name mongo -v /Users/andypang/code/mongoload:/etc/mongo -d mongo:3.6.12 --config /etc/mongo/mongod.conf
b5516fbf9619771e2d5c529296375654c288924211978d5969015594b320a890
apang-mbp:~ andypang$ docker exec -it mongo bash
root@b5516fbf9619:/# mongostat -O "wiredTiger.transaction.transaction checkpoint currently running=chkp_running","wiredTiger.transaction.transaction fsync calls for checkpoint after allocating the transaction ID=txn_fsync","wiredTiger.lock.schema lock acquisitions=schema_locks","wiredTiger.lock.schema lock application thread wait time (usecs)=schema_wait_app","wiredTiger.lock.txn global write lock acquisitions=txn_global_write","wiredTiger.lock.dhandle read lock acquisitions=dhandle_read","wiredTiger.lock.dhandle lock application thread time waiting (usecs)=dhandle_wait_app","wiredTiger.data-handle.connection data handles currently active=dh_active"
insert query update delete getmore command dirty used flushes vsize   res qrw arw net_in net_out conn                time chkp_running txn_fsync schema_locks schema_wait_app txn_global_write dhandle_read dhandle_wait_app dh_active table_int_us
    *0    *0     *0     *0       0     2|0  0.0% 0.0%       0  973M 67.0M 0|0 1|0   158b   60.9k    1 Dec  6 19:52:18.761            0         0           14               0                4           95                0        20            0
    *0    *0     *0     *0       0     1|0  0.0% 0.0%       0  973M 67.0M 0|0 1|0   157b   60.7k    1 Dec  6 19:52:19.764            0         0           14               0                4           99                0        20            0
    *0    *0     *0     *0       0     2|0  0.0% 0.0%       0  973M 67.0M 0|0 1|0   158b   61.0k    1 Dec  6 19:52:20.761            0         0           14               0                4          103                0        20            0
    *0    *0     *0     *0       0     1|0  0.0% 0.0%       0  973M 67.0M 0|0 1|0   157b   60.8k    1 Dec  6 19:52:21.761            0         0           14               0                4          107                0        20            0

apang-mbp:mongoload andypang$ npm start

> mongoload@1.0.0 start /Users/andypang/code/mongoload
> npm run build && node -r esm src/index.js


> mongoload@1.0.0 build /Users/andypang/code/mongoload
> tsc

{ databases: 1000,
  collections: 100,
  interval: 100,
  backoff: 0.7,
  inserts: 10,
  queries: 300,
  distribution: 'random',
  maxDocuments: 10,
  host: '127.0.0.1',
  port: '27017',
  poolSize: 100,
  reportInterval: 1000,
  url: 'mongodb://127.0.0.1:27017' }
Connected to mongo at mongodb://127.0.0.1:27017
2019-12-06T19:53:04.221Z
{
  "pulse": {
    "skip": 1,
    "init": 1,
    "done": 0,
    "time": 0,
    "latency": 0
  },
  "ops": {
    "insert": {
      "init": 10,
      "done": 4,
      "time": 310,
      "latency": 77,
      "error": 0
    },
    "query": {
      "init": 300,
      "done": 300,
      "time": 8267,
      "latency": 27,
      "error": 0
    }
  }
}