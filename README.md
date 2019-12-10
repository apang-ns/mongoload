# mongoload

Setup

Docker with 8 cores and 16GB of memory.
Node v10+ and Typescript installed.

Operation

apang-mbp:~ andypang$ docker run -p 27017:27017 --rm --name mongo -v /Users/andypang/code/mongoload:/etc/mongo -d mongo:3.6.12 --config /etc/mongo/mongod.conf
b5516fbf9619771e2d5c529296375654c288924211978d5969015594b320a890
apang-mbp:~ andypang$ docker exec -it mongo bash

mongostat -O "wiredTiger.transaction.transaction checkpoint currently running=chkp_running","wiredTiger.transaction.transaction checkpoint generation=chkp_id","wiredTiger.transaction.transaction fsync calls for checkpoint after allocating the transaction ID=txn_fsync","wiredTiger.transaction.transaction fsync duration for checkpoint after allocating the transaction ID (usecs)=fsync_usec","wiredTiger.lock.schema lock acquisitions=schema_locks","wiredTiger.lock.schema lock application thread wait time (usecs)=schema_wait_app","wiredTiger.lock.txn global write lock acquisitions=txn_global_write","wiredTiger.lock.table lock internal thread time waiting for the table lock (usecs)=table_int_us","wiredTiger.lock.dhandle read lock acquisitions=dh_read","wiredTiger.lock.dhandle write lock acquisitions=dh_write","wiredTiger.lock.dhandle lock application thread time waiting (usecs)=dh_wait_app","wiredTiger.data-handle.connection data handles currently active=dh_active","wiredTiger.data-handle.connection sweep dhandles closed=dh_closed","wiredTiger.data-handle.connection sweep time-of-death sets=dh_tod","wiredTiger.data-handle.connection sweep dhandles removed from hash list=dh_rm","wiredTiger.data-handle.session dhandles swept=dh_swept","wiredTiger.cache.eviction server candidate queue empty when topping up=evict_q_empty"

insert query update delete getmore command dirty used flushes vsize   res   qrw   arw net_in net_out conn                time chkp_running chkp_id txn_fsync fsync_usec schema_locks  schema_wait_app txn_global_write table_int_us  dh_read dh_write dh_wait_app dh_active dh_closed dh_tod  dh_rm dh_swept evict_q_empty
   271    *0     *0     *0       0     2|0  0.6% 8.7%       0 5.01G 3.80G 0|0 1|42  28.2k   63.5k  257 Dec 10 00:27:44.889            0     126       125    7272253       158261 1.0676737045e+10             8488     13540420 17341123   477129   129366065     96292     90795 344760 190418   227999          6511
   725    *0     *0     *0       0     1|0  0.6% 8.7%       0 5.01G 3.80G 0|0  1|0  29.9k   67.4k  257 Dec 10 00:27:45.890            0     126       125    7272253       158672 1.0736518903e+10             8492     13541207 17354436   485668   130351396     88474     91094 344760 198596   240547          6511
   260    *0     *0     *0       0     3|0  0.6% 8.8%       1 5.01G 3.80G 0|0 1|74  38.2k   63.3k  257 Dec 10 00:27:46.888            1     127       125    7272253       158720 1.0736594265e+10             8497     13541207 17354556   495313   130505023     98119     91094 344760 198596   240636          6511


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