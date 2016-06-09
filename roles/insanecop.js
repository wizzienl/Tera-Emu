const _ = require('lodash');
const ext = require('../lib/ext.js');

var cop = require('./cop.js');
module.exports = ext(cop, {
    id: 'insanecop',
    trueName: 'Insane Cop',
    secretDetails: `Scans are opposite of the truth!`,
    innocenceModifier: (innocent) => !innocent, // return flipped results
});