var modtask = function(chain) {
  chain([
    ['log', 'new task'],
    ['task.progress', 1],
    ['//chain/izy-pop3/chains/getParameters'],
    ['ROF'],
    ['//chain/izy-pop3/chains/setClientConfig'],
    ['ROF'],
    ['//chain/izy-pop3/chains/getDataItemIds'],
    ['ROF'],
    ['//chain/izy-pop3/chains/iterateDataItems'],
    ['ROF'],
    function (chain) {
      var dataItemIdList = chain.get('dataItemIdList');
      chain([
        ['task.setstate', chain.get('nextDataItemIdListIndex')],
        ['set', 'outcome', { success: true, reason: 'stored ' + dataItemIdList.length + ' items: ' + dataItemIdList.join(',') }],
        ['return']
      ]);
    }
  ]);
}
