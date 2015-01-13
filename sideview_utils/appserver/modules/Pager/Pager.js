Splunk.Module.Pager = $.klass(Splunk.Module.DispatchingModule, {
    
    initialize: function($super, container){
        $super(container);
        this.logger = Sideview.utils.getLogger();
        this.offset = 0;
        this.postProcessCount = -1;
        this.entityName = this.getParam("entityName");
        // Note that if the Pager is acting as the secondary Pager, 
        // it is exempted. Note implementation of validateHierarchy.
        this.childEnforcement = Splunk.Module.ALWAYS_REQUIRE;
        this.mergeLoadParamsIntoContext("results", ["count"]);
        this.container.click(this.onClick.bind(this));
        this.invisibilityMode = "goAwayWhenBlank";
        this.collapseWhenEmpty = Splunk.util.normalizeBoolean(this.getParam("collapseWhenEmpty"));
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
    },

    validateHierarchy: function($super) {
        if (this.getContext().has("results.upstreamPager")) return;
        $super();
    },


    /******************
     * listening to change from above.
     ****************/
    onContextChange: function(){
        this.offset = 0;
        this.postProcessCount=-1;
        var context = this.getContext();
        var search  = context.get("search");
        if (search.isJobDispatched() && this.getTotalCount()==0) {
            this.resetUI();
        }
        if (context.has("results.offset")) {
            this.offset = context.get("results.offset");
        }
        // if the offset is less than the new count, then we always reset the offset.
        if (this.offset!=0 && context.has("results.offset") && this.offset < parseInt(context.get("results.offset"), 10)  ){
            this.offset = 0;
        }
        if (search.getPostProcess() || this.haveResultParamsChanged()) {
            this.refresh();
        }
    },


    /******************
     * event stuff where we're talking to Jobber
     ****************/
    onBeforeJobDispatched: function(search) {
        if (this.entityName == "events") {
            search.setMinimumStatusBuckets(1);
        }
    },

    onJobProgress: function(event){
        var context = this.getContext();
        var search  = context.get("search");
        var postProcess = Splunk.util.trim(search.getPostProcess() || ""," ");
        if (!this.hasMaxPages() && (postProcess || this.getTotalCount() > 0)) {
            this.refresh();
        }
    },


    /******************
     * rendering the HTML back from our endpoint
     ****************/
    renderResults: function(htmlFragment) {
        if (this.collapseWhenEmpty) {
            if (htmlFragment.length==0) {
                this.hide(this.invisibilityMode);
            } else {
                this.show(this.invisibilityMode);
            }
        }
        this.container.html(htmlFragment);
    },


    /******************
     * dealing with the user's click on our page links.
     ****************/
    onClick: function(event){
        var eventTarget = $(event.target);
        if (!eventTarget.is("a")) return;
        if (eventTarget.hasClass('disabled')) return false;
        var context = this.getContext();
        var upstreamPagerReference = context.get("results.upstreamPager");
        if (upstreamPagerReference) {
            upstreamPagerReference.doClick(eventTarget);
            var upstreamTop = upstreamPagerReference.container.offset().top;
            var newScrollTop = Math.min($(window).scrollTop(), upstreamTop);
            $(window).scrollTop(newScrollTop);
       }
       return this.doClick(eventTarget);
    },

    doClick: function(element){
        var resource = element.attr("href");
        var qs = resource.split("?")[1];
        var qsDict = Splunk.util.queryStringToProp(qs);
        this.offset = parseInt(qsDict.offset, 10);
        
        this.pushContextToChildren();
        this.refresh();
        return false;
    },


    /******************
     * getting our data
     ****************/
    refresh: function() {
        var context = this.getContext();
        var search  = context.get("search");
        var postProcess = Splunk.util.trim(search.getPostProcess() || ""," ");
        this.postProcessCount = -1;
        if (postProcess) {
            if (search.job.getResultCount()>0 || (!search.job.areResultsTransformed() && search.job.getEventCount()>0)) {
                postProcess = Splunk.util.trim(postProcess,"|");
                var args = {};
                args["search"] = postProcess + " | stats count";
                args["outputMode"] = "json";
                var url = search.getUrl("results")+ "?" + Splunk.util.propToQueryString(args);
                if (search.job.isPreviewable() || search.getTimeRange().isRealTime()) {
                    url = url.replace("/results?","/results_preview?");
                }
                $.get(url, this.postProcessCountResponse.bind(this));
            }
        }
        else {
            this.getResults();
        }
    },

    postProcessCountResponse: function(jsonStr) {
        var results = Sideview.utils.getResultsFromJSON(jsonStr);
        if (results.length>0) {
            this.postProcessCount = parseInt(results[0]["count"],10);
        } else {
            this.logger.error("somehow we sent a search and post process with | stats count on the end and got 0 results back. This should never happen");
            this.postProcessCount = -1;
        }
        this.getResults();
    },

     /**
     * getting the params for getResults()
     */
    getResultParams: function(){
        var context = this.getContext();
        return {
            "count"      : context.get("results.count"),
            "offset"     : this.offset,
            "totalCount" : this.getTotalCount(),
            "maxPages"   : this.getParam("maxPages"),
            "app"        : Splunk.util.getCurrentApp()
        };
    },


    /******************
     * propagating information downstream
     ****************/
    getModifiedContext: function() { 
        var context = this.getContext();
        context.set("results.offset", parseInt(this.offset,10));
        context.set("results.upstreamPager", this);
        return context;
    },


    /******************
     * VARIOUS GETTERS
     ****************/
    /**
     * template method to be overridden in 'custom' situations.
     */
    getCustomCount: function() {
        return 0;
    },

    getTotalCount: function(){
        var context = this.getContext();
        var search  = context.get("search");
        var postProcess = Splunk.util.trim(search.getPostProcess() || ""," ")
        
        if (this.entityName == "custom") {
            return this.getCustomCount();
        } else {
            if (postProcess!="") {
                if (this.postProcessCount >-1) {
                    return this.postProcessCount;
                }
                return 0;
            }
            if (this.entityName=="events") {
                return search.getEventAvailableCount();
            } else {
                 return search.job.getResultCount();
            }
        }
    },

    hasMaxPages: function() {
        var context = this.getContext();
        return ($("li.page", this.container).length >= this.getParam("maxPages"));
    },


    /******************
     * misc
     ****************/
    resetUI: function(){
        this.offset = 0;
        this.container.html("");
    }

});
