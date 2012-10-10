var utils = require('../../utils')
    , _ = require('underscore')
    , MethodHandler = require('../methodHandler')

module.exports = MethodHandler.extend({

    setup:function () {
        this.post(this.url)
    },

    rules:function () {
        return this.context.validation
    },

    handler:function (model, context) {
        var self = this;
        return function (req, epi, next) {
            var resultCb = epi.cb(function (doc) {
                epi.expandModel(doc, context.expand)
                epi.created(doc)
            })
            new model(epi.body)
                .save(resultCb)
        }
    }

});