var utils = require('../../../utils')
    , _ = require('underscore')
    , MethodHandler = require('../../methodHandler')
    , mongoose = require('mongoose')

module.exports = MethodHandler.extend({

    setup:function () {
        var self = this;
        this.post(this.url + '/:id/' + this.embedded.attrName)
    },

    paramsRules:function () {
        return {
            id:function (v) {
                this.mongoId()
            }
        }
    },

    rules:function () {
        return this.embedded.validation;
    },

    handler:function (model, context) {
        var self = this;
        return function (req, epi, next) {
            var doc = epi.body
                , push = {}
            push[self.embedded.attrName] = doc;
            doc._id = new mongoose.Types.ObjectId;

            model.update(
                {_id:epi.params.id},
                {$push:push},
                epi.cb(
                    function (updated) {
                        if (!updated) return epi.lost()
                        return epi.created(doc);
                    }
                )
            )
        }
    }

});