const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/noAction.js'), {
    id: 'miller',
    name: 'Miller',
    description: `You have no active abilities, but you get scanned as scum by cops.`,
}, require('./mods/miller.js').mod);