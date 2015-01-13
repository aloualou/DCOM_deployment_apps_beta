// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.
Splunk.Module.Redirector = $.klass(Splunk.Module, {

    initialize : function($super, container) {
        $super(container);
        this.logger = Sideview.utils.getLogger();
        var prefix = "arg";
        // pull out all the args for our URI
        this.args = {};
        for (var key in this._params) {
            if (!this._params.hasOwnProperty(key)) continue;
            // if this param begins with "arg."
            if (key.length > prefix.length && key.indexOf(prefix) == 0) {
                this.args[key.substring(prefix.length+1)] = this._params[key];
            }
        }
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
    },

    resetUI: function() {},

    /**
     * given argList (basically just a map of the arg.* params)
     * returns a map of context values.
     */
    processArgs: function(context, argList) {
        var args = {};
        // do the inline replacement
        for (var key in argList) {
            if (!argList.hasOwnProperty(key)) continue;
            var modifiedKey = Sideview.utils.replaceTokensFromContext(key, context);
            var testValue = context.get(modifiedKey);
            if (testValue && typeof(testValue)=="object" && testValue.join) {
                // note that we do NOT attempt any $foo$ replacement on the array-valued value.
                args[modifiedKey] = testValue;
            } else {
                args[modifiedKey] = Sideview.utils.replaceTokensFromContext(argList[key], context);
            }
        }
        return args;
    },


    /**
     * this is a template method designed to be overridden in apps. 
     * You could just dance your way around overriding onContextChange
     * but this makes it a lot easier.
     */
    customEditArgs: function(context, finalArgs) {},

    /**
     * template method designed to be overridden in apps
     * using the customBehavior mechanism.
     */
    getURL: function(context) {
        return this.getParam("url");
    },

    /**
     * Once the page is loaded, even a single call to onContextChange will 
     * trigger redirection.  As a result this is commonly hidden underneath 
     * a SubmitButton with allowSoftSubmit set to False, or under an 
     * interactive SimpleResultsTable module.
     */
    onContextChange: function() {
        if (!this.isPageLoadComplete()) {
            this.logger.info(this.moduleType + ".onContextChange() called but page is still loading. Aborting redirect.");
            return false;
        }
        var context = this.getContext();
        
        Sideview.utils.setStandardTimeRangeKeys(context, this.getParam("fillExplicitAllTimeArgs"));
        Sideview.utils.setStandardJobKeys(context);

        var args = this.processArgs(context, this.args);

        this.customEditArgs(context, args);

        var url = Sideview.utils.replaceTokensFromContext(this.getURL(context), context);
        url += "?" + Sideview.utils.dictToString(args);

        var newWindow = context.get("click.modifierKey") || Splunk.util.normalizeBoolean(this.getParam("popup"), true);
        if (newWindow) {
            window.open(url, "_blank", "resizable=yes,status=no,scrollbars=yes,toolbar=no");
        } else {
            document.location = url;
        }
    }
});
