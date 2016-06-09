module.exports = (num, str, pluralString, singleString) => {
    return num + ' ' + str + (num == 1 ? (singleString || '') : (pluralString || 's'));
}