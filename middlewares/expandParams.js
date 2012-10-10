var async = require('async')
    , mongoose = require('mongoose')

// Helpers
var
// Translation of the route params into models
    routeParamModel = function (name) {
        return {
            'user':mongoose.model('User')
        }[name];
    }

// Expands all models in the req.params into mongoose objects
module.exports = function (req, res, next) {
    var params = [];
    for (var param in req.params) {
        params.push({name:param, val:req.params[param]});
    }

    if (params.length) {
        async.every(params
            , function (param, cb) {
                routeParamModel(param.name).findOne({_id:param.val}, function (err, doc) {
                    if (err) return cb(false);
                    // Well, we haven't found a resource we were asked.. let's
                    // transmit this
                    if (!doc) return cb(false)
                    req.params[param.name] = doc;
                    return cb(true)
                })
            }, function (result) {
                return result ? next() : res.send(404);
            }
        );
    }
}