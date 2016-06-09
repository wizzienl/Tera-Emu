const _ = require('lodash');
const ext = require('../lib/ext.js');

var cop = require('./cop.js');
module.exports = ext(cop, {
    id: 'paranoidcop',
    trueName: 'Paranoid Cop',
    secretDetails: `Scans always return scum!`,
    innocenceModifier: (innocent) => false, // return scum always
});