var utils = require('../../../utils')
    , _ = require('underscore')
    , MethodHandler = require('../../methodHandler')
    , mongoose = require('mongoose')

module.exports = MethodHandler.extend({

    setup:function () {
        var self = this;
        this.delete(this.url + '/:id/' + this.embedded.attrName + '/:idEmbedded')
    },

    paramsRules:function () {
        return {
            id:function () {
                this.mongoId()
            },
            idEmbedded:function () {
                this.mongoId()
            }
        }
    },

    handler:function (model, context) {
        var self = this;
        return function (req, epi, next) {
            var pull = {}
            pull[self.embedded.attrName] = {
                _id:epi.params.idEmbedded
            };

            model.update(
                {_id:epi.params.id},
                {$pull:pull},
                epi.cb(
                    function () {
                        epi.deleted();
                    }
                )
            )
        }
    }

});