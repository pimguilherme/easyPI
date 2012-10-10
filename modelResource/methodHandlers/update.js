var utils = require('../../utils')
    , _ = require('underscore')
    , MethodHandler = require('../methodHandler')

module.exports = MethodHandler.extend({

    setup:function () {
        this.put(this.url + '/:id')
    },

    paramsRules:function () {
        return {
            id:function () {
                this.mongoId()
            }
        }
    },

    rules:function () {
        return this.context.validation
    },

    handler:function (model, context) {
        var self = this;
        return function (req, epi, next) {
            model.findById(epi.params.id, epi.cb(function (doc) {
                if (!doc) return epi.lost();
                doc.update(self.filterAttributes(all), function () {
                    epi.expandModel(doc, context.expand)
                    epi.updated(doc)
                })
            }))
        }
    }

});