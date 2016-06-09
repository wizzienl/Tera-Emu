const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/noAction.js'), {
    id: 'godfather',
    name: 'Godfather',
    description: `You have no active abilities, but you get scanned as innocent by cops.`,
}, require('./mods/inno.js').mod);