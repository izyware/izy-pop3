var config = require('../configs/izy-pop3/taskrunner');

require('izy-proxy').newChain([
    // Use this to adjust the paths defined in modtask/config/kernel/extstores/file.js
    // So that all the relative and absolute paths to pkgs and modules are accessible
    // ['sysview'],
    ['chain.importProcessor', 'configs/izy-proxy/context'],
    ['ROF'],
    ['chain.importProcessor', 'apps/tasks/api:chain'],
    ['ROF'],
    ['taskrunner.authenticate', config.authenticate],
    ['ROF'],
    ['chain.importProcessor', 'apps/storage/fs:chain'],
    ['ROF'],
    ['set', 'config', config],
    ['taskrunner.onNewTask', ['//chain/izy-pop3/chains/onNewTask']],
    ['taskrunner.setRuntimeID', config.izyware_runtime_id],
    ['taskrunner.config', config.runner],
    ['taskrunner.listen'],
    ['returnOnFail']
], console.log);
