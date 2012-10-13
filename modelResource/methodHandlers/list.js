var utils = require('../../utils')
    , _ = require('underscore')
    , MethodHandler = require('../methodHandler')

module.exports = MethodHandler.extend({

    setup:function () {
        var self = this

        this.defaultQuery = this.options.defaultQuery
            ? this.options.defaultQuery(this.model, this.context)
            : function () { return self.model }

        this.get(this.url)

        _.each(this.options.custom, function (queryBuilder, route) {
            self.get(route, self.queryHandler(queryBuilder(self.model)))
        })
    },

    queryRules:function () {
        // When listing we don't need to validate model data
        return {
            lastId:function () {
                this.nullable()
                    .mongoId()
            },
            skip:function () {
                this.nullable()
            },
            limit:function () {
                this.nullable(20)
                    .enum(5, 10, 20)
            }
        }
    },

    paramsRules:function () {
        return {
            id:function () {
                this.nullable()
                    .mongoId()
            }
        }
    },

    queryHandler:function (queryBuilder) {
        var context = this.context;
        return function (req, epi, next) {
            // Answers when the models are fetched
            var resultCb = epi.cb(function (docs) {
                epi.expandModel(docs, context.expand);
                epi.fetched(context.name, docs, docs.length == epi.query.limit);
            }).bind(this);
            // Processes the query
            var queryCb = function (query) {
                if (epi.query.skip) {
                    query
                        .skip(epi.query.skip)
                        .limit(epi.query.limit)
                        .exec(resultCb)
                    return
                }
                query
                    .find(epi.query.lastId ? {_id:{$lt:epi.query.lastId}} : {})
                    .limit(epi.query.limit)
                    .sort('-_id')
                    .exec(resultCb)
            }

            var query = queryBuilder.call(this, req, epi, queryCb)
            if (query && !epi.hasErrors()) {
//                if (typeof query == 'function') {
//                    return query(queryCb)
//                } else {
                    return queryCb(query)
//                }
            }
        }
    },

    handler:function (model, context) {
        return this.queryHandler(this.defaultQuery)
    }

});