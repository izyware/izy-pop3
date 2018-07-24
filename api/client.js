var modtask = function() {}

// JSON In/JSON Out
modtask.__apiInterfaceType = 'jsonio';
modtask.processQueries = function(queryObject, cb) {
    if (modtask.actions[queryObject.action]) {
        return modtask.actions[queryObject.action](queryObject, cb);
    }
    return cb({
        reason: 'unknown action: ' + queryObject.action
    });
}

modtask.actions = {};
modtask.actions.runCmd = function(queryObject, cb) {
    modtask.doChain([
        ['nop'],
        function() {
            modtask.ldmod('rel:../clientpop3/index')(queryObject.config, cb);
        }
    ], cb);
}
