var slice = Array.prototype.slice;

module.exports = function (Sanidator) {

    Sanidator.setFilters({

        // Indicates whether the value is a valid mongo ObjectId
        mongoId:function (v) {
            if (!v) return this.err('object_required');
            if (v && v.length == 24) return
            this.err('invalid_mongoid')
        },

        //
        // Types
        //

        // Validates a date
        date:function (v, d) {
            try {
                this.val((v = new Date(v)))
                if (v == 'Invalid Date') {
                    return this.err("invalid_date")
                }
            } catch (e) {
                return this.err("invalid_date")
            }

            if (!(v instanceof Date)) {
                this.err("date_expected")
            }
        },

        str:function (v) {
            this.val(v.toString());
        },

        array:function (v) {
            if (!(v instanceof Array)) this.err('array_expected');
        },

        // Garante que é um inteiro
        int:function (v, d) {
            if (v instanceof Number) return

            this.val(v = parseInt(v))
        },

        //
        // Nullables
        //

        notNull:function (v) {
            if (!v) return this.err('notnull');
        },

        notnull:function () {
            this.notNull()
        },

        // If the value is not given, it may be considered valid fast
        nullable:function (v, d, def) {
            if (!v) {
                this.val(def);
                this.skip();
            }
        },

        'null':function (v) {
            if (v) return this.err('must_be_null');
        },

        ignore:function () {
            this.val(null);
        },


        // Remove espaços em branco
        trim:function (v) {
            this.val(v.trim());
        },

        // Garante um tamanho
        len:function (v, d, min, max) {
            if (max === undefined) {
                if (v.length != min) {
                    this.err('invalid_len');
                }
            } else {
                if (v.length < min || (max != null && v.length > max)) {
                    this.err('invalid_len');
                }
            }
        },

        'enum':function (v, d) {
            var set = slice.call(arguments, 2);
            var found = 0;
            set.forEach(function (item) {
                if (item == v) return (found = true) && false;
            })
            if (!found) this.err('invalid_enum, expected [' + set + ']');
        },

        // Validação com callbacks

        func:function (v, d, func) {
            func.call(this, v, d)
        },

        each:function (v, d, func) {
            for (var i = 0; i < v.length; i++) {
                if (func.call(this, v[i]) !== true && this.error) {
                    return;
                }
            }
        }

    });

}