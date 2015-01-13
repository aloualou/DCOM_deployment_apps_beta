// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.
Splunk.Module.PostProcess = $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        $super(container);
        this.logger = Sideview.utils.getLogger();
        this.childEnforcement = Splunk.Module.ALWAYS_REQUIRE;
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
    },

    resetUI: function() {},

    /** 
     * see comment on DispatchingModule.requiresTransformedResults
     */
    requiresTransformedResults: function() {
        return true;
    },

    /**
     * get the 'search' param, wash the context keys through it to replace 
     * any $foo$ tokens, then set it as the postProcess argument for 
     * downstream modules
     */
    getModifiedContext: function(context) {
        if (!context) context = this.getContext();
        var searchObject  = context.get("search");
        
        // preserve any old postProcess values as $postProcess$
        var oldPostProcessSearch = searchObject.getPostProcess() || context.get("postProcess");
        context.set("postProcess", oldPostProcessSearch);

        var postProcessSearch = this.getParam('search');
        postProcessSearch = Sideview.utils.replaceTokensFromContext(postProcessSearch, context);
        
        // put the new postProcess in both ways
        searchObject.setPostProcess(postProcessSearch);
        context.set("postProcess", postProcessSearch);

        context.set("search", searchObject);
        return context;
    }
});