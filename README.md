# mongoload

## Setup

Docker with 8 cores and 16GB of memory.

Node v10+ and Typescript installed.

https://nodejs.org/en/download/
https://www.typescriptlang.org/

## Operation

### Mongo

```
apang-mbp:~ andypang$ docker run -p 27017:27017 --rm --name mongo -v /Users/andypang/code/mongoload:/etc/mongo -d mongo:3.6.12 --config /etc/mongo/mongod.conf
b5516fbf9619771e2d5c529296375654c288924211978d5969015594b320a890
apang-mbp:~ andypang$ docker exec -it mongo bash

mongostat -O "wiredTiger.transaction.transaction checkpoint currently running=chkp_running","wiredTiger.transaction.transaction checkpoint generation=chkp_id","wiredTiger.transaction.transaction fsync calls for checkpoint after allocating the transaction ID=txn_fsync","wiredTiger.transaction.transaction fsync duration for checkpoint after allocating the transaction ID (usecs)=fsync_usec","wiredTiger.lock.schema lock acquisitions=schema_locks","wiredTiger.lock.schema lock application thread wait time (usecs)=schema_wait_app","wiredTiger.lock.txn global write lock acquisitions=txn_global_write","wiredTiger.lock.table lock internal thread time waiting for the table lock (usecs)=table_int_us","wiredTiger.lock.dhandle read lock acquisitions=dh_read","wiredTiger.lock.dhandle write lock acquisitions=dh_write","wiredTiger.lock.dhandle lock application thread time waiting (usecs)=dh_wait_app","wiredTiger.data-handle.connection data handles currently active=dh_active","wiredTiger.data-handle.connection sweep dhandles closed=dh_closed","wiredTiger.data-handle.connection sweep time-of-death sets=dh_tod","wiredTiger.data-handle.connection sweep dhandles removed from hash list=dh_rm","wiredTiger.data-handle.session dhandles swept=dh_swept","wiredTiger.cache.eviction server candidate queue empty when topping up=evict_q_empty"

insert query update delete getmore command dirty used flushes vsize   res   qrw   arw net_in net_out conn                time chkp_running chkp_id txn_fsync fsync_usec schema_locks  schema_wait_app txn_global_write table_int_us  dh_read dh_write dh_wait_app dh_active dh_closed dh_tod  dh_rm dh_swept evict_q_empty
   271    *0     *0     *0       0     2|0  0.6% 8.7%       0 5.01G 3.80G 0|0 1|42  28.2k   63.5k  257 Dec 10 00:27:44.889            0     126       125    7272253       158261 1.0676737045e+10             8488     13540420 17341123   477129   129366065     96292     90795 344760 190418   227999          6511
   725    *0     *0     *0       0     1|0  0.6% 8.7%       0 5.01G 3.80G 0|0  1|0  29.9k   67.4k  257 Dec 10 00:27:45.890            0     126       125    7272253       158672 1.0736518903e+10             8492     13541207 17354436   485668   130351396     88474     91094 344760 198596   240547          6511
   260    *0     *0     *0       0     3|0  0.6% 8.8%       1 5.01G 3.80G 0|0 1|74  38.2k   63.3k  257 Dec 10 00:27:46.888            1     127       125    7272253       158720 1.0736594265e+10             8497     13541207 17354556   495313   130505023     98119     91094 344760 198596   240636          6511
```

### Applying Load

```
apang-mbp:mongoload andypang$ npm install
npm WARN mongoload@1.0.0 No repository field.

added 137 packages from 151 contributors and audited 1426 packages in 3.788s

5 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

apang-mbp:mongoload andypang$ npm start -- "{ host: '127.0.0.1' }"

> mongoload@1.0.0 start /Users/andypang/code/mongoload
> npm run build && node -r esm src/index.js


> mongoload@1.0.0 build /Users/andypang/code/mongoload
> tsc

{
  "numDatabases": 192,
  "numCollections": 128,
  "frequencyScale": 1,
  "precreate": true,
  "rampup": false,
  "host": "127.0.0.1",
  "port": "27017",
  "reportIntervalMs": 1000,
  "ops": {
    "insert": {
      "opsPerInterval": 4,
      "concurrency": 512,
      "intervalMs": 100,
      "maxDocumentsPerOp": 5
    },
    "query": {
      "opsPerInterval": 32,
      "concurrency": 2048,
      "intervalMs": 100
    },
    "update": {
      "opsPerInterval": 16,
      "concurrency": 512,
      "intervalMs": 100
    },
    "replSetGetStatus": {
      "opsPerInterval": 5,
      "concurrency": 1024,
      "intervalMs": 1000
    },
    "serverStatus": {
      "opsPerInterval": 2,
      "concurrency": 64,
      "intervalMs": 1000
    }
  }
}
Creating 192 databases with 128 collections
Connected to mongo at "mongodb://127.0.0.1:27017" with pool size undefined
Client creation for createCollections: 26.887ms
Created 128 collections in database database_0
Created 128 collections in database database_1
Created 128 collections in database database_2
Created 128 collections in database database_3
Created 128 collections in database database_4

The second time running the script on the same mongo instance, there is no need
to precreate collections.

apang-mbp:mongoload andypang$ npm start -- "{ host: '127.0.0.1', precreate: false }"

> mongoload@1.0.0 start /Users/andypang/code/mongoload
> npm run build && node -r esm src/index.js "{ host: '127.0.0.1', precreate: false }"


> mongoload@1.0.0 build /Users/andypang/code/mongoload
> tsc

{
  "numDatabases": 192,
  "numCollections": 128,
  "frequencyScale": 1,
  "precreate": false,
  "rampup": false,
  "host": "127.0.0.1",
  "port": "27017",
  "reportIntervalMs": 1000,
  "ops": {
    "insert": {
      "opsPerInterval": 4,
      "concurrency": 512,
      "intervalMs": 100,
      "maxDocumentsPerOp": 5
    },
    "query": {
      "opsPerInterval": 32,
      "concurrency": 2048,
      "intervalMs": 100
    },
    "update": {
      "opsPerInterval": 16,
      "concurrency": 512,
      "intervalMs": 100
    },
    "replSetGetStatus": {
      "opsPerInterval": 5,
      "concurrency": 1024,
      "intervalMs": 1000
    },
    "serverStatus": {
      "opsPerInterval": 2,
      "concurrency": 64,
      "intervalMs": 1000
    }
  }
}
Connected to mongo at "mongodb://127.0.0.1:27017" with pool size 64
Client creation for serverStatus: 23.217ms
Connected to mongo at "mongodb://127.0.0.1:27017" with pool size 2048
Client creation for query: 25.732ms
Connected to mongo at "mongodb://127.0.0.1:27017" with pool size 1024
Client creation for replSetGetStatus: 25.002ms
Connected to mongo at "mongodb://127.0.0.1:27017" with pool size 512
Client creation for insert: 36.460ms
Connected to mongo at "mongodb://127.0.0.1:27017" with pool size 512
Client creation for update: 26.106ms
2019-12-11T16:41:22.597Z 'Elapsed: 1 seconds'
{
  "startTime": 1576082481596,
  "insert": {
    "init": 27,
    "done": 6,
    "time": 2092,
    "latency": 348,
    "error": 0,
    "skip": 0
  },
  "query": {
    "init": 261,
    "done": 155,
    "time": 30152,
    "latency": 194,
    "error": 0,
    "skip": 0
  },
  "update": {
    "init": 131,
    "done": 69,
    "time": 12682,
    "latency": 183,
    "error": 0,
    "skip": 0
  },
  "replSetGetStatus": {
    "init": 0,
    "done": 0,
    "time": 0,
    "latency": 0,
    "error": 0,
    "skip": 0
  },
  "serverStatus": {
    "init": 0,
    "done": 0,
    "time": 0,
    "latency": 0,
    "error": 0,
    "skip": 0
  }
}
```