var
    MethodHandler = require('./methodHandler')
    , _ = require('underscore')
// Local libs
    , utils = require('../utils')
    ;

var
    error = utils.scopedError('easyPI.ModelResource')
    , log = utils.scopedLog('easyPI.ModelResource')
    , slice = Array.prototype.slice
// Returns the ModelName associated with a path in a given model
    , getModelPathRef = function (path, model) {
        path.split('.').forEach(function (path) {
            if (!model.schema) return false;
            model = model.schema.paths[path]
        });
        return model.options.ref;
    }
    ;


var ModelResource = function (epi, models) {
    this.epi = epi;
    this.models = models;

    if (!models) error('You must supply a set of models indexed by their name');

    // Registered routes
    this.routes = {};
    // Method handlers, indexed by Model#method
    this.methodHandlers = {};
}

ModelResource.prototype = {

    defaultRegisterOptions:{
        // By default, all nested attributes are included
        includeAll:true
    },

    register:function (options) {
        if (!options) error('You must supply options', options);
        _.extend(options, this.defaultRegisterOptions)

        if (!options.url) error('A URL must be defined', options)
        if (!options.name) error('You must supply a model name', options);
        if (!(options.methods instanceof Array)) error('You must supply an array for accepted methods', options);
        options.methods = _.unique(options.methods)

        // Resource Model
        // We need a valid model to extract resources from
        options.model = this.models[options.name];
        if (!options.model) error('The model is invalid', options.name, options);

        var self = this;
        //
        // Model expansions
        //
        if (options.expand) {
            var expand = {};
            // We'll parse the expansion requirements into an object of the type
            // {
            //  [path]: {name: ModelName, model: Model}
            //  ...
            // }
            // Here we got an array where the references are defined in the model
            if (options.expand instanceof Array) {
                _.unique(options.expand).forEach(function (path) {
                    if (!(typeof path == 'string')) error('Invalid expansion path, expected string', path);
                    expand[path] = {  name:getModelPathRef(path, options.model)  }
                    expand[path].model = self.models[expand[path].name];
                    if (!expand[path].model) error('Invalid reference for expansion path', expand[path], path, options);
                })
            }
            // And here we have an object indexed by the path and with the value of the reference's ModelName
            // {
            //   'user': 'User',
            //   'comments.user': 'User'
            //   ...
            // }
            else {
                _.each(options.expand, function (val, path) {
                    if (!(typeof val == 'string')) error('Invalid expansion reference, expected string', path);
                    expand[path] = { name:val }
                    expand[path].model = self.models[expand[path].name];
                    if (!expand[path].model) error('Invalid reference for expansion path', expand[path], path, options);
                })
            }
            options.expand = expand;
        }

        //
        // Model inflations
        //
        if (options.inflate) {
            var inflate = {};
            if (options.inflate instanceof Array) {
                _.unique(options.inflate).forEach(function (path) {
                    if (!(typeof path == 'string')) error('Invalid inflation path, expected string', path);
                    inflate[path] = {  name:getModelPathRef(path, options.model)  }
                    inflate[path].model = self.models[inflate[path].name];
                    if (!inflate[path].model) error('Invalid reference for inflation path', inflate[path], path, options);
                })
            }
            else {
                _.each(options.inflate, function (val, path) {
                    if (!(typeof val == 'string')) error('Invalid inflation reference, expected string', path);
                    inflate[path] = { name:val }
                    inflate[path].model = self.models[inflate[path].name];
                    if (!inflate[path].model) error('Invalid reference for inflation path', inflate[path], path, options);
                })
            }
            options.inflate = inflate;
        }

        //
        // Methods registration
        //
        // Loop through each method and add the proper handler
        _.each(options.methods, function (method) {
            self.registerMethod(method, options, null, options.methodOptions && options.methodOptions[method])
        })

        // Embedded attributes
        _.each(options.embedded, function (embeddedOptions, attr) {
            if (!(embeddedOptions.methods instanceof Array)) error('You must supply an array for accepted methods', attr, embeddedOptions);
            embeddedOptions.attrName = attr;
            // Embedded methods registration
            _.each(embeddedOptions.methods, function (method) {
                self.registerMethod('embedded/' + method, options, embeddedOptions, embeddedOptions.methodOptions && embeddedOptions.methodOptions[method])
            })
        })
    },

    // Registers a new method handler and initiates it
    registerMethod:function (name, context, embeddedAttribute, options) {
        if (!ModelResource.methodHandlers[name]) error('Invalid method handler', name)
        var id = this.methodIdentifier(context.name, embeddedAttribute, name);
        if (this.methodHandlers[id]) error('Method handler already registered', id);
        var handler = this.methodHandlers[id] = new ModelResource.methodHandlers[name](this.epi, context, embeddedAttribute, options)
        handler.setup();
    },

    // Returns the identifier for a method
    methodIdentifier:function (modelName, embedded, method) {
        return modelName + (embedded ? '.' + embedded : '') + '#' + method;
    }


}

//
// Mass middleware hooking
//
require('./methodHandler').callbackTypes.forEach(function (name) {
    ModelResource.prototype[name] = function (url, middlewares, priority, before) {
        var methodHandler = this.methodHandlers[url];
        if (methodHandler) {
            methodHandler[name](middlewares, priority, before)
        } else {
            log('Invalid method handler for "' + name + '" callback', url)
        }
    }
})

//
// Handlers registration
//

ModelResource.methodHandlers = {};
// Registers a new method handler for the ModelResource
ModelResource.addMethodHandler = function (name, handler) {
    if (ModelResource.methodHandlers[name]) error('Method handler already defined', name);
    ModelResource.methodHandlers[name] = handler;
}

// Default handlers
_.each(require('./methodHandlers'), function (handler, name) {
    ModelResource.addMethodHandler(name, handler);
})
_.each(require('./methodHandlers/embedded'), function (handler, name) {
    ModelResource.addMethodHandler('embedded/' + name, handler);
})

module.exports = ModelResource;