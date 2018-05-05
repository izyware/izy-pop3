
var modtask = function(config) {

  modtask.verbose = config.verbose || 0;
  if (modtask.verbose) modtask.Log(JSON.stringify(config));

  var tableName = config.tablename;
  if (!tableName) {
    return { reason: 'Please specify the tablename for the cloud store.' };
  }
  var groupid = config.groupid || 0;
  var itemid = config.itemid || null;

  var tags = modtask.tags;

  var commitmode = config.commitmode;

  modtask.consumeItem = function(item, cb) {
    modtask.Log('consume ' + item.id);
    modtask.markAs(item, 'staged', function(outcome) {
      if (outcome.success) {
        cb(item.payload);
        // archiveFile(item.name);
      } else {
        modtask.Log('WARNING: markAs failed: ' + outcome.reason);
      }
    });
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

    if (modtask.verbose > 1 && !commitmode) modtask.Log('commit mode off. ignoring markAs');
    modtask.getNode(config).runQuery2([
        commitmode ? `update ${tableName} set status = ${statusId} where id = ${item.id} limit 1` : 'select 1'
        // `select body from where id = ${item.id} limit 1`
      ],
      function (output) {
        cb({ success: true });
      },
      cb
    );
  }

  modtask.query = function(cb, tags, limit) {
    if (!limit) {
      limit = 1;
    }

    if (!config.orderBy) {
      config.orderBy = 'desc';
    }

    var totalSize = 0;
    var fields = [`id`, `status`, `groupid`, `messageUTCTimestamp`, `created`, `sourceid`, `guid`, `size` , `payload`];


    if (config.simulate) {
      return modtask.simulateResponse(config, cb);
    }

    var condition = '';
    if (itemid) {
      condition = `id = ${itemid}`;
    } else {
      condition = `status = 0 and groupid = ${groupid}`;
    }
    modtask.getNode(config).runQuery2(
      `select ${fields.join(',')} from ${tableName} where ${condition} limit ` + limit,
      function (rows) {
        var ret = [];
        for (var i = 0; i < rows.length; i++) {
          var size = 1;
          var row = rows[i];
          var item = {};
          var j;
          for(j=0; j < fields.length; ++j) {
            item[fields[j]] = row[j];
          }
          ret.push(item);
          if (modtask.verbose > 1) modtask.Log(JSON.stringify(item));
          totalSize += size;
        };
        cb({
          success: true,
          totalSize: totalSize,
          count: ret.length,
          items: ret
        });
      }, cb
    );
  }

  var getStatus = function(okpush, fail) {
    modtask.runQuery2([
      `select status, count(id) from ${tableName} group by status`
    ], function(data) {
      var i;
      var ret = {};
      for(i=0; i < tags.length; ++i) {
        ret[tags[i]] = 0;
      }
      for(i=0; i < data.length; ++i) {
        ret[tags[data[i][0]]] = data[i][1];

      }
      okpush(ret);
    }, fail);
  }

  modtask.runQuery2 = function(qs, ok, fail) {
    if (qs == 'status') {
      return getStatus(ok, fail);
    }
    return modtask.getNode(config).runQuery2(qs, ok, fail);
  }
  
  modtask.addItems = function(items, cb) {
    modtask.runQuery2([
      modtask.ldmod('sql/q').getUpsert(tableName, items)
    ], function(data) {
      cb({ success: true })
    }, cb);
  }

  modtask.success = true;
  return modtask;
}

modtask.getNode = function(config) {
  return modtask.ldmod('ui/node/direct').sp({
    // Unless you already have one -- if so skip the thing below
    'accesstoken' : config.accesstoken? config.accesstoken : false,

    //  'tunnelendpointid' : 'endpointid',

    'dataservice': config.dataservice,
    'groupidobject': {
      transportmodule: 'qry/transport/http'
    }, // default is true
    encryptqueries : (modtask.verbose == 'true' ? false : true)
  }).sp('verbose', false);
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



modtask.simulateResponse = function(config, cb) {
  console.log('simulate response');
  var i;
  var limit = config.limit || 10;
  var ret = [];
  var totalSize = 0;
  var item;
  for(var i=0; i < limit; ++i) {
    var rnd = 'ff0' + i + Math.random(10000) * 10;
    var bodylen = 10000 + Math.random()*100000;
    var str = '';
    var j;
    for(j=0; j < bodylen / rnd.length; ++j) {
      str += rnd;
    }

    var obj = {
      id: i,
      messageTimestamp: 'Thu, 19 Nov 2015 08:47:08 -0800',
      readBy: 'read@test.com',
      sender: 'send@test.com',
      channel: 'channe@test.com',
      channelId: i + '',
      domain: 'test',
      body: 'testbodyxxx ' + str
    };
    var content = modtask.convertToMime(obj);
    var item = {
      id: i,
      status: 0,
      groupid: config.groupid,
      messageUTCTimestamp: 0,
      created: 0,
      sourceid : 'simulate',
      guid: rnd,
      size: content.length,
      payload: content
    };
    console.log(item);
    ret.push(item);
    totalSize += item.size;
  }

  cb({
    success: true,
    totalSize: totalSize,
    count: ret.length,
    items: ret
  });
}

modtask.convertToMime = function(obj) {
  var customHeader1 = JSON.stringify({ id: obj.id });
  var date = 'Fri, 27 Jun 2008 11:38:36 -0400';
  var dt = obj.messageTimestamp.split(' ')[0].split('-');
  date = dt[2] + ' ' + dt[1] + ' ' + dt[0] + ' ' + obj.messageTimestamp.split(' ')[1] + ' -0700';
  var content = `X-IZS-CustomHeader1: ${customHeader1}
From: "${obj.sender}" <${obj.sender.replace(/ /g, '.')}@${obj.domain}>
To: "${obj.readBy}" <${obj.readBy.replace(/ /g, '.')}@${obj.domain}>, "${obj.channelId}" <${obj.channelId.replace(/ /g, '.')}@${obj.domain}>
Date: ${date}
Content-Type: text/plain;
Subject: RE: [${obj.channel}] - ${obj.readBy}

${obj.body}

`;
  return content;
}
