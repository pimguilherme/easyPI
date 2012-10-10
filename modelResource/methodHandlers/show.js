var utils = require('../../utils')
    , _ = require('underscore')
    , MethodHandler = require('../methodHandler')

module.exports = MethodHandler.extend({

    setup:function () {
        this.get(this.url + '/:id')
    },

    paramsRules:function () {
        // When listing we don't need to validate model data
        return {
            id:function () {
                this.mongoId()
            }
        }
    },

    handler:function (model, context) {
        return function (req, epi, next) {
            var resultCb = epi.cb(function (doc) {
                if (!doc) return epi.lost();
                epi.expandModel(doc, context.expand);
                epi.fetched(doc);
            }).bind(this);
            model
                .findById(epi.params.id)
                .exec(resultCb)
        }
    }

});