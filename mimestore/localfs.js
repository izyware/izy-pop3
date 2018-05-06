
var modtask = function(config) {

  var fs = require('fs');

  var tags = ['archive', 'staged', 'dup'];

  var storePath = config.path;
  var commitmode = config.commitmode;


  var error = function(msg) {
    throw 'persistentStore error: ' + msg;
  }

  var consumeItem = function(item, cb) {
    var contents = stageFile(item.name);
    cb(contents);
    archiveFile(item.name);
  }

  var markAs = function(item, tag) {
    if (config.verbose > 1) modtask.Log('markAs(' + tag + '): ' + item.name);
    if (tags.indexOf(tag) === -1) {
      return error('persistentStore. Invalid tag ' + tag);
    }
    moveFile(item.name, tag, storePath, 'archive');
  }

  var pathCombine = function(p1, p2) {
    if (!p1.endsWith('/')) {
      p1 += '/';
    }
    var ret = p1 + p2;
    ret = ret.replace(/\/\//g, '/');
    return ret;
  }

  var moveFile = function(item, label, basePath, current) {
    var path = basePath;
    if (current) {
      path = pathCombine(basePath, current) + '/';
    }
    var p1 = pathCombine(path, item);
    var p2 = pathCombine(pathCombine(basePath, label + '/'), item);
    if (config.verbose > 1) modtask.Log('move ' + p1 + ' -> ' + p2);
    if (commitmode) {
      fs.renameSync(p1, p2);
    } else {
      if (config.verbose > 1) modtask.Log('non commit mode -- not moving file');
    }
  }


  var stageFile = function(item) {
    var fname = pathCombine(storePath, item);
    if (config.verbose > 1) modtask.Log('Staging: ' + fname);
    var fs = require('fs');
    var contents = fs.readFileSync(fname); // , 'utf8');
    moveFile(item, 'staged', storePath);
    return contents;
  }

  var archiveFile = function(item) {
    if (config.verbose > 1) modtask.Log('Archiving: ' + item)
    moveFile(item, 'archive', storePath, 'staged');
  }

  var query = function(cb, tags, limit) {
    var path = storePath;

    if (!limit) {
      limit = 10;
    }

    if (config.verbose > 1) modtask.Log('query -- tags: ' + tags + ', limit: ' + limit);
    if (config.verbose > 1) modtask.Log('query -- path: ' + path);
    var items = fs.readdirSync(path).sort(function(a,b) {
      if (config.orderBy == 'desc') {
        return a < b;
      } else {
        return a > b;
      }
    });
    var sofar = 0;
    var ret = []
    var totalSize = 0;
    for (var i = 0; i < items.length; i++) {
      if (!items[i].endsWith('.eml')) {
        continue;
      }
      if (items[i].indexOf('.dup.eml') > 0) {
        moveFile(items[i], 'dup', path);
      } else if (items[i].indexOf('.decodeerror.eml') > 0) {
      } else {
        var size = fs.statSync(pathCombine(path, items[i])).size;
        ret.push({
          name: items[i],
          guid: items[i].split('.')[0],
          size: size
        });
        totalSize += size;
        if (limit && ret.length >= limit) {
          break;
        }
      }
    };

    cb({
      success: true,
      totalSize: totalSize,
      count: ret.length,
      items: ret
    });
  }

  addItems = function(items) {
    items.forEach(function(item) {
      addItem(item);
    });
  }

  var addItem = function(item) {
    if (config.verbose) console.log('recieved: msgid=' + item.guid + ' size<' + Math.round(item.size/1000 + 1) + 'kb');
    var fname = item.sourceid+ '_' + item.guid;
    if (!storePath) {
      modtask.Log('Not persisting since no path provided for "' + fname + '"');
    } else {
      fname = storePath + '/' + fname;
      while(fs.existsSync(fname + '.eml')) {
        fname += '.dup';
      }
      fname = fname + '.eml';
      modtask.Log('writing ' + fname);
      fs.writeFileSync(fname, item.payload);
    }
  }

  var verifyTagFoldersExist = function() {
    if (!storePath) {
      return error('Invalid storePath: ' + storePath);
    }
    var i;
    for(i=0; i < tags.length; ++i) {
      var tag = tags[i];
      var path = pathCombine(storePath, tag);
      if (!fs.existsSync(path)) {
        return { reason: 'Please mkdir ' + path + '. it is needed for ' + tag } ;
      }
    }
    return { success: true };
  }

  var outcome = verifyTagFoldersExist();
  if (!outcome.success) return outcome;

  return {
    success: true,
    addItems: addItems,
    query: query,
    consumeItem: consumeItem,
    markAs: markAs
  }
}
