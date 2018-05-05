
var modtask = function (config) {
	modtask.verbose = config.verbose || 0;
	var verify = function(p1, p2) {
		if (p1.length < p2.length) {
			p2 = p2.substr(0, p1.length);
		}
		if (p1 != p2) {
			for (var i = 0, len = p1.length; i < len; i++) {
				if (p1[i] != p2[i] && p1[i] != '*') {
					return {
						reason: 'verify failed:\n-----------expected----------\n' + JSON.stringify(p1) + '\n--------------actual---------------\n' + JSON.stringify(p2) + '...\n'
					};
				}
			}
		}
		return { success: true };
	}

	var getStore = function() {
		var myConfig = config.mimestore || {};
		if (!myConfig.modhandler) myConfig.modhandler = 'fake';
		return modtask.ldmod('rel:mimestore/' + myConfig.modhandler)(myConfig);
	}
	
	var testStore = function() {
		var mimeStore = getStore();
		if (!mimeStore.success) {
			return modtask.Log('error: ' + mimeStore.reason);
		}
		var myConfig = config.query || {};
		mimeStore.query(function(result) {
			console.log(result);
		}, myConfig.tags, myConfig.limit);
	}

	switch (config.testtype) {
		case 'fullclientserver':
			modtask.ldmod(`rel:test/${config.testtype}`)(config);
			break;
		case 'mimestore':
		default:
			testStore();
			break;
	}
};
