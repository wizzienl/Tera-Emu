var objs = [];
require('fs').readdirSync(__dirname + '/').forEach(file => {
  if (file.match(/\.js$/) !== null && file !== 'index.js') {
    objs.push(require('./' + file));
  }
});
module.exports = objs;