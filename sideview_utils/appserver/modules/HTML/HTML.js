// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.

Splunk.Module.HTML= $.klass(Splunk.Module.DispatchingModule, {
    
    
    
    initialize: function($super, container) {
        $super(container);
        this.logger = Sideview.utils.getLogger();
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
        this.searchFields = [];
        this.resultsKey = [];
    
        //get the list of row+name dictionaries
        this.findDynamicKeys();

        this.maxRow = 0;

        //dedup the names and get the highest row #
        var fields = {};
        var pair; 
        for (var i=0,len=this.searchFieldPairs.length; i<len; i++) {
            pair = this.searchFieldPairs[i];
            fields[pair["name"]] = 1;
            this.maxRow = Math.max(this.maxRow, pair["row"]);
        }
        if (this.maxRow>=parseInt(this.getParam("maxRows"),10)) {
            alert("an HTML module is configured to get " + (this.maxRow+1) + " rows, but the maxRows param is only set to " + this.getParam("maxRows") + ".  The answer is probably to rework the configuration at the search langauge level to need fewer rows.");
        }
        for (name in fields) {
            this.searchFields.push(name);
        }
        this.isDynamic = (this.searchFields.length + this.resultsKeys.length > 0);
    },

    resetUI: function() {},

    /** 
     * see comment on DispatchingModule.requiresTransformedResults
     */
    requiresTransformedResults: function() {
        return this.isDynamic;
    },

    /**
     * look for any tokens that refer to properties or field values in 
     * the search RESULTS. If there are any present, then this module 
     * behaves quite differently.
     */
    findDynamicKeys: function() {
        // part 1. get the list of keys requested.
        // to do this we cheat. We modify a context to sneak in as a mole.
        var html = this.getParam("html") || "";
        var allKeys = [];

        // sneaky mole is sneaky.
        var mole = new Splunk.Context();
        mole.get = function(name) {allKeys.push(name);}
        Sideview.utils.replaceTokensFromContext(html, mole);
        
        // part 2a find any dynamic keys and get the row #'s and field names
        var rowAndFieldNames = [];
        var fieldFinder = /results\[(\d+)?\]\.(.+)?/;
        // part 2b find things like 'results.count'  or 'results.eventCount' 
        var resultsKeys  = [];
        var resultsKeyPrefix = "results.";
        
        for (var i=allKeys.length-1; i>-1; i--) {
            var m = fieldFinder.exec(allKeys[i]);
            if (m && m.length>0) {
                rowAndFieldNames.push({"row":m[1],"name":m[2]});
            }
            else if (allKeys[i].indexOf(resultsKeyPrefix)==0) {
                resultsKeys.push(allKeys[i]);
            }
        }
        this.searchFieldPairs = rowAndFieldNames;
        this.resultsKeys = resultsKeys;
    },

    /**
     * get the loadingText, which might be 'Loading...' or 
     * in fancy cases,  'Loading values of $someSelectedField$...'
     */
    getLoadingText: function(context) {
        // i18n peoples will have to preserve any $foo$ values in the string.
        var template = _(this.getParam("loadingText"));
        return Sideview.utils.replaceTokensFromContext(template, context)
    },

    /**
     * if the module is configured dynamically then we have to trigger 
     * a new dispatched search. Note that we actually defer to 
     * DispatchingModule to calculate it.
     */
    requiresDispatch: function($super, context) {
        if (!this.isDynamic) return false;
        else return $super(context);
    },

    requiresTransformedResults: function() {
        return (this.isDynamic);
    },

    /**
     * if the module is configured dynamically then we have to tell the 
     * framework to put the field(s) into the requiredFields list 
     * on the job before it gets kicked off.
     */
    onBeforeJobDispatched: function(search) {
        if (this.isDynamic) {
            //search.setMinimumStatusBuckets(1);
            // we have to manually copy the array (to workaround SPL-37431)
            var requiredFields = $.extend(true,[],this.searchFields);
            search.setRequiredFields(requiredFields);
        }
    },

    /** 
     * These 2 are pulled out as template methods just to make 
     * customBehavior overrides easier
     */
    addCustomKeys: function(context) {},
    getHTML: function(html, context) {
        Sideview.utils.setStandardTimeRangeKeys(context);
        Sideview.utils.setStandardJobKeys(context, true);
        return Sideview.utils.replaceTokensFromContext(html, context)
    },

    /**
     * This washes the context through so that all the 'results[0].fieldName'
     * keys get populated with whatever text is in the 'loadingText' param.
     */
    addPlaceholderValues: function(context) {
        var placeholderValue = this.getLoadingText(context);
        for (var i=0,len=this.searchFieldPairs.length; i<len; i++) {
            var row = this.searchFieldPairs[i]["row"];
            var name = this.searchFieldPairs[i]["name"];
            context.set("results[" + row + "]." + name, placeholderValue);
        }
    },
    
    /**
     * time to make the donuts
     */
    worthRequestingNewRows: function(context) {
        var job = context.get("search").job;
        return (this.searchFields.length>0 && (job.isDone() || (job.getResultCount() > 0)))
    },

    /**
     * time to make the donuts
     */
    renderHTML: function(context) {
        this.container.html("");
        var template = this.getParam("html", "") || ""
        this.addCustomKeys(context);
        var header = this.getHTML(template, context);
        this.container.html(header);
     },

    /**
     * if we're configured with any static values then we'll have to go get our data.
     */
    onContextChange: function(context) {
        var context = context || this.getContext();
        if (this.isDynamic && this.worthRequestingNewRows(context)) {
            this.addPlaceholderValues(context);
            this.getResults();
        }
        this.renderHTML(context);
    },

    /**
     * it may or may not be time to make the donuts
     */
    onJobDone: function() {
        if (this.searchFields.length > 0) {
            this.getResults();
        }
        // if we have things like 'results.count' update now.
        if (this.resultsKeys.length>0 && this.searchFields==0) {
            this.renderHTML(this.getContext());
        }
    },

    /**
     * it may or may not be time to make the donuts
     */
    onJobProgress: function() {
        if (this.isDynamic) {
            var context = this.getContext();
            var search  = context.get("search");
            // if it's done it'll get updated by onJobDone.
            if (search.job.isDone()) return;
            // if we have things like 'results[0].fieldName' 
            if (search.job.isPreviewable() && this.worthRequestingNewRows(context)) {
                this.getResults();
            }
            // if we have things like 'results.count' update now.
            if (this.resultsKeys.length>0 && this.searchFields==0) {
                this.renderHTML(context);
            }
        }
    },

    /**
     * returns the URL used by the module to GET its results.
     */
    getResultURL: function(params) {
        var context = this.getContext();
        var search  = context.get("search");
        // sadly the getUrl method has a bug where it doesnt handle params
        // properly in the 'results' endpoint.
        var url = search.getUrl("results");

        // as of a while ago S&I changed it so that results_preview is always safe. 
        url = url.replace("/results", "/results_preview");
        params["count"] = this.maxRow+1;
        
        var existingPostProcess = search.getPostProcess() || "";
        params["search"] = existingPostProcess + " | fields " + this.searchFields.join(",");
        params["outputMode"] = "json";

        return url + "?" + Splunk.util.propToQueryString(params);
    },
    
    /** 
     * called each time we get new data from the server.
     * once we have the data, we make the donuts.
     * if you are reading these comments then I probably know you already and 
     * you're one of my favorite splunk developers. If one or both statements 
     * are temporarily untrue email me to rectify both.
     */
    renderResults: function(jsonStr) {
        if (!jsonStr) {
            this.logger.error("empty string returned in " + this.moduleType + ".renderResults");
            this.logger.debug(jsonStr);
        }
        var results = Sideview.utils.getResultsFromJSON(jsonStr);
        var context = this.getContext();
        var row, name;
        for (var i=0,len=results.length;i<len;i++) {
            row = results[i];
            for (field in row) {
                if (row.hasOwnProperty(field)) {
                    name = "results[" + i + "]." + field;
                    context.set(name, row[field]);
                }
            };
        };
        this.renderHTML(context);
    }

});