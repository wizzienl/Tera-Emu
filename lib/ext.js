module.exports = (...args) => {
    var obj = {};
    for (var i = 0; i < args.length; i++) {
        var item = args[i];
        for (var prop in item) {
            Object.defineProperty(obj, prop, Object.getOwnPropertyDescriptor(item, prop));
        }
    }
    return obj;
}