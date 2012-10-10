var utils = require('../../utils')
    , _ = require('underscore')
    , MethodHandler = require('../methodHandler')

module.exports = MethodHandler.extend({

    setup:function () {
        this.addCallback('deleted', this.options.deleted)

        this.delete(this.url + '/:id')
    },

    paramRules:function () {
        return {
            id:function () {
                this.mongoId()
            }
        }
    },

    handler:function (model, context) {
        var self = this
            ;

        return function (req, epi, next) {
            var resultCb = epi.cb(function (doc) {
                if (!doc) return epi.lost();
                doc.remove(function () {
                    epi.deleted(doc)
                })
            }).bind(this);
            model
                .findById(epi.params.id)
                .exec(resultCb)
        }
    }

});