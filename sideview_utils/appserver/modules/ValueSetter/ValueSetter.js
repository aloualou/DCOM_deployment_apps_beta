// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.
Splunk.Module.ValueSetter = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);
        this.childEnforcement = Splunk.Module.ALWAYS_REQUIRE;
        this.logger = Sideview.utils.getLogger();
        this.mode = this.getParam("mode");

        this.requiredKeys  = this.getArrayParam("requiredKeys");
        this.urlEncodeKeys  = this.getArrayParam("urlEncodeKeys");
        this.backslashKeys  = this.getArrayParam("backslashEscapeKeys");
        
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
        this.allowClobber = Splunk.util.normalizeBoolean(this.getParam("allowClobber"));
        this.modifyingContext = true;
    },

    resetUI: function() {},

    getParam: function($super, name) {
        if (name=="delim") {
            var orig = $super(name);
            if (!orig) return orig;
            return Sideview.utils.replacePlusSigns(orig);
        }
        return $super(name);
    },

    getArrayParam: function(name) {
        var value = this.getParam(name);
        if (!value) return [];
        var arr = value.toString().split(",");
        for (var i=0,len=arr.length; i<len; i++) {
            arr[i] =  Splunk.util.trim(arr[i]," ");
        }
        return arr;
    },

    withEachContextValue: function(context, arr, callback) {
        for (var i=0,key,len=arr.length; i<len; i++) {
            key = arr[i];
            if (!context.has(key)) continue;
            context.set(key, callback(context.get(key).toString()));
        }
    },

    allRequiredKeysPresent: function(context) {
        var matches = 0;
        for (var i=0,len=this.requiredKeys.length; i<len; i++) {
            if (context.has(this.requiredKeys[i]) && context.get(this.requiredKeys[i])!="") {
                matches++;
            }
        }
        if ((this.mode=="OR" && matches==0) || (this.mode=="AND" && matches<this.requiredKeys.length)) {
            return false;
        }
        return true;
    },

    onContextChange: function() {
        var context = this.getContext();
        var name = Sideview.utils.replaceTokensFromContext(this.getParam("name"), context);
        // if we're configured NOT to allow clobbering, and we have a value from above, 
        // we simmer down.
        if (!this.allowClobber && context.has(name)) {
            this.modifyingContext = false;
            this.setChildContextFreshness(false);
        } else {
            this.modifyingContext = true;
        }
    },

    /**
     * Modifies the context so as to add in a single string-valued key.
     * For every $foo$ token found in this string, if there is a matching
     * value in the context as set by all modules upstream, those dynamic
     * values will be substituted into the string.
     */
    getModifiedContext: function(context) {
        
        context = context || this.getContext();
        if (!this.modifyingContext) {
            return context;
        }

        
        // note that it will never urlEncode or backslashEscape the values 
        // going into the name param...
        // I cant think of why you would ever want this. it sounds evil.
        var name = Sideview.utils.replaceTokensFromContext(this.getParam("name"), context);
        
        // with $foo$ replacement on name, the name can end up empty. 
        // we dont output anything if that is the case.
        if (!name) return context; 

        // or if one of our requiredKeys are missing, we also bail.
        if (!this.allRequiredKeysPresent(context)) return context;
        
        var search = context.get("search");
        // encoding and special keys are only applied to a cloned copy of 
        // the context that we use to calculate the value, because we don't 
        // want to pass any of these modified keys downstream.
        var encodedContext = context.clone();
        
        if (typeof(search=="object")) {
            Sideview.utils.setStandardTimeRangeKeys(encodedContext,false,search);
            Sideview.utils.setStandardJobKeys(encodedContext,false,search);
        }

        this.withEachContextValue(encodedContext, this.urlEncodeKeys, function(value) {
            return encodeURIComponent(value)
        });
        this.withEachContextValue(encodedContext, this.backslashKeys, function(value) {
            return Sideview.utils.escapeBackslashes(value);
        });
        
        var outputValue = Sideview.utils.replaceTokensFromContext(this.getParam("value"), encodedContext);
        if (this.getParam("delim")) {
            outputValue = outputValue.split(this.getParam("delim"));
        }
        context.set(name, outputValue);
        return context;
    }
});