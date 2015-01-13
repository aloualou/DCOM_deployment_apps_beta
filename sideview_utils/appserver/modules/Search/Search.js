// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.
Splunk.Module.Search = $.klass(Splunk.Module, {

    initialize: function($super, container) {
        $super(container);
        this.logger = Sideview.utils.getLogger();
        this.childEnforcement = Splunk.Module.ALWAYS_REQUIRE;
        
        // TODO - assert that the tokens we're converting contain only safe chars
        //this.tokenValidator = new RegExp("\\w");
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
    },

    resetUI: function() {},

    /**
     * Modifies the context so as to add in a "search" key whose value is an
     * instance of Splunk.Search,  and whose searchstring will be the value of
     * the module's 'search' param.    For every $foo$ token found in this
     * string, if there is a matching value in the context as set by all
     * modules upstream, those dynamic values will be substituted into the
     * searchstring.
     */
    getModifiedContext: function(context) {
        if (!context) context = this.getContext();
        var search  = context.get("search");
        search.abandonJob();

        if (this._params.hasOwnProperty('search')) {
            
            var s = this.getParam('search');

            if (s) {
                // we wont return this one. But we need the full set of tokens
                // for $foo$ replacements in the search param.
                var internalContext = this.getContext();
                Sideview.utils.setStandardTimeRangeKeys(internalContext);
                Sideview.utils.setStandardJobKeys(internalContext);
                search.setBaseSearch(Sideview.utils.replaceTokensFromContext(s, internalContext));
            }
        }
        if (this.getParam("earliest") || this.getParam("latest")) {
            var range = new Splunk.TimeRange(this.getParam("earliest"), this.getParam("latest"));
            search.setTimeRange(range);
            Sideview.utils.setStandardTimeRangeKeys(context);
            // never give these downstream...
            //Sideview.utils.setStandardJobKeys(context);
        }
        if (this._params.hasOwnProperty("maxTime")) {
            search.setMaxTime(this.getParam("maxTime"));
        }
        context.set("search", search);
        return context;
    }
});