const ext = require('../lib/ext.js');

module.exports = ext(require('./tmpls/noAction.js'), {
    id: 'vanilla',
    name: 'Vanilla',
    description: `You have no special abilities.`,
});