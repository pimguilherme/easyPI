var http = require('http')
    , _ = require('underscore')
// Local libs
    , utils = require('./utils')
    ;

var
    error = utils.scopedError('easyPI')
    , log = utils.scopedLog('easyPI')
    , slice = Array.prototype.slice
    ;


// API middleware for easiness
var easyPI = function (app, options) {
    this.app = app;
    this.response = {}
    this.models = options.models;
    this.options = _.extend({}, this.defaultOptions, options)

    this._modelResource = new ModelResource(this, this.options.models)

    // Initializes the routes caching array
    this.routes = {};
    this.orderedRoutes = [];
    easyPI.methods.forEach(function (method) {
        this.routes[method] = {};
    }, this)
}

easyPI.prototype = {

    // Options to get merged with the instance options
    defaultOptions:{
        // This prefix will be applied to all routes
        routePrefix:''
    },

    // Configures a resourceful model in the API
    model:function (options) {
        this._modelResource.register(options);
    },

    // Wraps a route handler (get, post, etc..) and binds to this epi object
    wrapRoute:function (obj) {
        if (!obj) error('Invalid route configuration', obj);
        var self = this;

        // An array - let's wrap each of them
        if (obj instanceof Array) {
            return obj.map(function (handler) {
                return self.wrapRoute(handler)
            })
        }
        // Sanitizing
        // Regular handler, converting for unique point of wrapping below
        if (typeof obj == 'function') {
            obj = {
                handler:obj
            }
        }
        // Middleware from our stack
        else if (typeof obj == 'string') {
            if (!this.middlewares[obj]) error('Invalid middleware', obj);
            obj = {
                handler:this.middlewares[obj]
            }
        }

        // Here we are expecting a configurable handler, with rules of validation
        if (typeof obj.handler != 'function') {
            error('Invalid route handler', obj.handler, obj);
        }
        return function (req, res, next) {
            var epi = res.epi || (res.epi = new Response(self, req, res, next));
            try {
                // Default route validation rules
                if (obj.rules) {
                    epi.rules(obj.rules);
                }
                if (obj.queryRules) {
                    epi.errors.query.rules(obj.queryRules);
                }
                if (obj.paramsRules) {
                    epi.errors.params.rules(obj.paramsRules);
                }
                if (!epi.validate()) return;
                obj.handler.call(this, req, epi, next)
            } catch (e) {
                epi.raise(e)
            }
        }

    },

    // Gets a descriptor for the given route
    routeDescriptor:function (method, route) {
        return method.toUpperCase() + ' ' + (this.options.routePrefix + route)
    },

    // Prints all the registered routes to the console
    printRoutes:function () {
        console.log('-------------------------')
        console.log("Registered routes:")
        console.log('-------------------------')
        this.orderedRoutes.forEach(function (route) {
            console.log(route.split(' ').join("\t"))
        })
        console.log('-------------------------')
    }

};


// Methods accepted for routing
easyPI.methods = ['get', 'post', 'delete', 'put']

// HTTP Verbs for routing
easyPI.methods.forEach(function (method) {
    easyPI.prototype[method] = function (route) {
        var self = this;
        // Route Uniqueness
        if (this.routes[method][route]) {
            error('Route already defined ', this.routeDescriptor(method, route));
        }
        this.routes[method][route] = true;
        this.orderedRoutes.push(this.routeDescriptor(method, route))

        // Handler
        this.app[method].apply(this.app,
            [this.options.routePrefix + route]
                // All the middlewares will now be wrapped by the EPI object
                .concat(slice.call(arguments, 1).map(function (cb) {
                    return self.wrapRoute(cb)
                }
            ))
        )
    }
})

easyPI.prototype.middlewares = require('./middlewares');

var Response = easyPI.Response = require('./response')
var ModelResource = easyPI.ModelResource = require('./modelResource');

module.exports = easyPI;