
var modtask = function(config) {

  modtask.verbose = config.verbose || 0;
  var groupid = config.groupid || 0;

  var tags = modtask.tags;

  var commitmode = config.commitmode;

  modtask.consumeItem = function(item, cb) {
    modtask.Log('consumeItem');
    console.log(item);
    cb('payload_data');
  }

  modtask.markAs = function(item, tag, cb) {
    if (!cb) {
      modtask.Log('WARNING cb not provided for markAs');
      cb = function() {};
    }
    var statusId = tags.indexOf(tag);
    if (statusId == -1) {
      return cb({ reason: 'Invalid tag: ' + tag });
    }
    cb({ success: true });
  }

  modtask.query = function(cb, tags, limit) {
    if (!limit) {
      limit = 1;
    }

    if (!config.orderBy) {
      config.orderBy = 'desc';
    }

    modtask.Log('query -- tags: ' + tags + ', limit: ' + limit);

    // the only fields that the system cares about is guid and size
    var items = [];
    var i;
    for(i=1; i < 10; ++i) {
      items.push({
        guid: `guid_${i}`,
        size: (i+1)*10
      });
    }
    cb({
      success: true,
      count: items.length,
      items: items
    });
  }

  var getStatus = function(okpush, fail) {
    var i;
    var ret = {};
    for(i=0; i < tags.length; ++i) {
      ret[tags[i]] = tags[i].length;
    }
    okpush(ret);
  }

  modtask.runQuery2 = function(qs, ok, fail) {
    fail( { reason: 'not supported '});
  }
  
  modtask.addItems = function(items, cb) {
    fail( { reason: 'not supported '});
  }

  return modtask;
}

modtask.tags = ['unread', 'archive', 'staged', 'dup', 'pop3failed', 'conversionerror'];

modtask.markObjectAs = function(obj, tag) {
  var tags = modtask.tags;
  var statusId = tags.indexOf(tag);
  if (statusId !== -1) {
    obj.status = statusId;
    return { success: true };
  }
  return { reason: 'Invalid tag: ' + tag };
}
