var utils = require('../utils')
    , HandlerCallbackList = require('./callbackList')
    , _ = require('underscore')
    ;

var
    error = utils.scopedError('easyPI.ModelResource')

// Responsible for handling a route with a model
var MethodHandler = function (epi, context, embedded, options) {
    this.epi = epi;
    this.url = context.url;
    this.model = context.model;

    this.context = context;
    this.embedded = embedded;

    this.callbacks = {
        before:new HandlerCallbackList,
        preprocess:new HandlerCallbackList,
        after:new HandlerCallbackList
    };
    this.runners = {};

    // Other options
    this.options = options || {};

    // Custom handler options
    if (options) {
        MethodHandler.callbackTypes.forEach(function (name) {
            this.addCallback(name, options[name]);
        }, this)
    }

}

MethodHandler.prototype = {

    rules:function () {
        return null
    },

    paramsRules:function () {
        return null;
    },

    queryRules:function () {
        return null;
    },

    setup:function () {
        error('A setup method must be implemeted');
    },

    // This is main callback to be run in the route
    handler:function () {
        error('A handler must be implemeted');
    },

    // This callback finishes the handling
    finish:function (req, epi, next) {
        epi.send();
    },

    // This is what actually registers the callbacks on the API routes
    registerRoute:function (method, url, handler) {
        var self = this
            , beforeRunner = this.callbacks.before.createRunner(function (req, epi, next) {
                epi.inflateBody(self.context.inflate, next)
            })
            , runner = this.callbacks.preprocess.createRunner(
                // We want to make sure everything is valid before going to the main handler
                function (req, epi, next) {
                    if (!epi.validate()) return;
                    next();
                },
                function (req, epi, after) {
                    epi.autoSend = false;
                    epi.autoNext = true;
                    var next = function () {
                        epi.autoNext = false;
                        epi.autoSend = true;
                        after();
                    }
                    handler.call(this, req, epi, next);
                },
                this.callbacks.after,
                self.finish.bind(this)
            )

        this.epi[method](url, function (req, epi, next) {
                self.filterAttributes(epi.body)
                beforeRunner(this, [req, epi], epi)
            },
            {
                rules:this.rules(),
                queryRules:this.queryRules(),
                paramsRules:this.paramsRules(),
                handler:function (req, epi, next) {
                    runner(this, [req, epi], epi)
                }
            }
        )
    },

    //
    // Helpers
    //

    filterAttributes:function (values) {
        var definitions = this.rules()
        for (var name in values) {
            if (!definitions[name]) delete values[name];
        }
    },

    addCallback:function (name, cb, priority, before) {
        // Callback validation
        var self = this;
        if (!name || !cb) return;

        if (cb instanceof Array) {
            return cb.forEach(function (cb) { self[name](cb, priority, before) });
        }

        if (typeof cb == 'string') {
            var cbName = cb;
            cb = this.epi.middlewares[cb]();
            if (!cb || typeof cb != 'function') error('Invalid handler middleware', cbName);
        } else if (typeof cb == 'object') {
            if (!cb.name || !this.epi.middlewares[cb.name]) error('Invalid handler middleware', cb.name);
            cb = this.epi.middlewares[cb.name](cb);
        }

        if (typeof cb != 'function') {
            error('Invalid handler middleware', name, cb);
        }

        // Parameter mapping
        if (typeof priority == 'boolean') {
            before = priority;
            priority = 50;
        } else if (priority == undefined) {
            priority = 50;
        }

        if (!this.callbacks[name]) this.callbacks[name] = new HandlerCallbackList;
        // Registration
        this.callbacks[name].add(cb, priority, before)
    },

    fireCallbacks:function (name, context, req, epi) {
        if (!this.callbacks[name]) return;
        if (!this.runners[name]) {
            this.runners[name] = this.callbacks[name].createRunner();
        }
        this.runners[name](context, [req, epi], epi)
    }

};


//
// Route registrators
//
['get', 'post', 'put', 'delete'].forEach(function (name) {
    MethodHandler.prototype[name] = function (url, handler) {
        return this.registerRoute(name, url, handler || this.handler(this.model, this.context))
    }
});

//
// Callback registrators
//
MethodHandler.callbackTypes = ['before', 'after', 'preprocess']
var callbackTypeHandler =
    MethodHandler.callbackTypes.forEach(function (name) {
        MethodHandler.prototype[name] = function () {
            this.addCallback.apply(this, [name].concat(Array.prototype.slice.call(arguments, 0)))
        }
    })

MethodHandler.extend = utils.extend;

module.exports = MethodHandler;