var config = require('../configs/izy-pop3/taskrunner');

var seqs = {};
seqs.onNewTask = [
    ['task.progress', 10],
    ['task.reason', 'getting params and list of messages'],
    ['task.getparameters'],
    ['task.getstate'],
    function(chain) {
        var state = chain.get('taskState');
        if (!state || state == '') {
            state = '0'; // message id to start from
        }

        chain.set('lastObjId', state);
        var parametersJSON = JSON.parse(chain.get('taskParameters'));
        var clientConfig = {
            cmd: 'list',
            verbose: true,
            user: parametersJSON.user,
            tls: true,
            ip: parametersJSON.ip,
            port: parametersJSON.port,
            pass: parametersJSON.password
        };

        if (!parametersJSON.password) {
            if (!config.passwordLookup) return chain([
                ['task.outcome', { reason: 'No password specified via parameters and the internal config does not define passwordLookup. Abort' }],
                ['return']
            ]);
            clientConfig.pass = config.passwordLookup[parametersJSON.user];
        }

        chain.set('clientConfig', clientConfig);
        chain(['set', 'outcome', { success:true, data: {} }]);
        /*  todo: be smarter about the next objects and use listData in addition to lastObjId
        chain(['///izy-pop3/api/client', {
            action: 'runCmd',
            config: clientConfig
        }]);
        */
    },
    function(chain) {
        var outcome = chain.get('outcome');
        if (!outcome.success) return chain([
            ['task.outcome', outcome],
            ['return']
        ]);

        /**** todo: be smarter about the next objects and use listData in addition to lastObjId ****/
        var listData = outcome.data; // { items: [ ...], idIndexHash }
        var nextObjId = chain.get('lastObjId') * 1 + 1;
        chain.set('nextObjId', nextObjId);
        chain(['task.reason', 'getting object ' + nextObjId]);
    },
    function(chain) {
        var clientConfig = chain.get('clientConfig');
        clientConfig.cmd = 'retr';
        clientConfig.query = {
            id: chain.get('nextObjId')
        };
        chain(['///izy-pop3/api/client', {
            action: 'runCmd',
            config: clientConfig
        }]);
    },
    function(chain) {
        var nextObjId = chain.get('nextObjId');
        var outcome = chain.get('outcome');
        if (!outcome.success) return chain([
            ['task.outcome', outcome],
            ['return']
        ]);
        // todo: store the object in the data storage system (as binary!)
        // console.log('xxx', outcome.data.toString());
        chain([
            ['task.setstate', nextObjId],
            ['task.outcome', { success: true, reason: 'stored 1 item with id: ' + nextObjId + ' with size: ' + outcome.data.length }],
            ['return']
        ]);
    }
];

require('izy-proxy').newChain([
    // Use this to adjust the paths defined in modtask/config/kernel/extstores/file.js
    // So that all the relative and absolute paths to pkgs and modules are accessible
    // ['sysview'],
    ['chain.importProcessor', 'configs/izy-proxy/context'],
    ['returnOnFail'],
    ['chain.importProcessor', 'apps/tasks/api:chain'],
    ['returnOnFail'],
    ['taskrunner.authenticate', config.authenticate],
    ['returnOnFail'],
    ['taskrunner.onNewTask', seqs.onNewTask],
    ['taskrunner.setRuntimeID', config.izyware_runtime_id],
    ['taskrunner.config', {
        loopMode: true,
        readOnlyMode: false,
        delay: 5000
    }],
    ['taskrunner.listen'],
    ['returnOnFail']
], console.log);

