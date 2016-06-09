const _ = require('lodash');
const ext = require('../lib/ext.js');

var cop = require('./cop.js');
module.exports = ext(cop, {
    id: 'naivecop',
    trueName: 'Naive Cop',
    secretDetails: `Scans always return innocent!`,
    innocenceModifier: (innocent) => true, // return innocent always
});