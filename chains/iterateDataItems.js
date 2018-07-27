var modtask = function(chain) {
  var dataItemIdList = chain.get('dataItemIdList');
  var index = 0;
  chain([
    ['task.reason', 'getting data item ids ' + dataItemIdList.join(',')],
    ['newChain', {
      chainName: modtask.__myname + '.innerChain',
      chainItems: [
        ['set', 'clientConfig', chain.get('clientConfig')],
        function(chain) {
          if (index >= dataItemIdList.length) {
            return chain([
              ['log', 'finished processing all'],
              ['set', 'outcome', { success: true }],
              ['return']
            ]);
          }
          chain([
            ['task.progress', Math.round((index / (dataItemIdList.length+1)) * 100)],
            ['log', (index+1) + ' of ' + dataItemIdList.length],
            ['set', 'dataItemId', dataItemIdList[index++]],
            ['//chain/izy-pop3/chains/downloadDataItem']
          ]);
        },
        ['ROF'],
        ['replay']
      ]
    }]
  ]);
};

