var modtask = function(chain) {
  chain([
    ['task.getparameters'],
    function(chain) {
        var parametersJSON = Object.assign({
          limit: 10
        }, JSON.parse(chain.get('taskParameters')));
        return chain([
          ['set', 'parametersJSON', parametersJSON]
        ]);
    } 
	]);
}
