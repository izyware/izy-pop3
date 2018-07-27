var modtask = function(chain) {
  chain([
    ['task.getstate'],
    function(chain) {
      // because of the way the pop3 server returns the results,  we simply store the position in the list that we should grab from
      var state = chain.get('taskState');
      var clientConfig = Object.assign({}, chain.get('clientConfig'));
      if (!state || state == '') {
        state = '0'; // start from position 0
      }
      clientConfig.cmd = 'list';
      // we may or may not be able to use state to craft a porper query here
      // in case of pop3 servers that just list everything so we wont use state here
      chain([
        ['set', 'currentDataItemIdListIndex', state],
        ['///izy-pop3/api/client', {
          action: 'runCmd',
          config: clientConfig
        }]
      ]);
    },
    ['ROF'],
    function(chain) {
      var listData = chain.get('outcome').data;
      var currentDataItemIdListIndex = parseInt(chain.get('currentDataItemIdListIndex'));
      var dataItemIdList = [];
      var limit = chain.get('parametersJSON').limit;
      var nextDataItemIdListIndex;
      for(nextDataItemIdListIndex=currentDataItemIdListIndex;
          nextDataItemIdListIndex < currentDataItemIdListIndex + limit && nextDataItemIdListIndex < listData.items.length;
          ++nextDataItemIdListIndex) {
        dataItemIdList.push(listData.items[nextDataItemIdListIndex].id);
      }
      chain([
        ['set', 'dataItemIdList', dataItemIdList],
        ['set', 'nextDataItemIdListIndex', nextDataItemIdListIndex]
      ]);
    }
	]);
}

