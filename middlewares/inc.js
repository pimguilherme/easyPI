var utils = require('../utils')
    , _ = require('underscore')

/**
 * Middleware para autenticação de usuário com Facebook
 */

module.exports = function (options) {

    var sets = options.sets;

    return function (req, epi, after) {
        var incs = sets.apply(this, arguments)
            , c = 1
            , next = epi.cb(function () {
                if (--c <= 0) return after();
            })
        _.each(incs, function (spec) {
            c++;
            models[spec[0]].update(spec[1], {$inc:spec[2]}, {multi:true}, next)
        })
        next();
    }
}