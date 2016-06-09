var obj = [];
require('fs').readdirSync(__dirname + '/').forEach(file => {
  if (file.match(/\.js$/) !== null && file !== 'index.js') {
    obj.push(require('./' + file));
  }
});
module.exports = obj;