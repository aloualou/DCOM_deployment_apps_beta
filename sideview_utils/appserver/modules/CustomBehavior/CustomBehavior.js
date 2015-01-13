// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.


Splunk.Module.CustomBehavior = $.klass(Splunk.Module.DispatchingModule, {
    initialize: function($super, container) {
        $super(container);
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
    },
    requiresDispatch: function($super, search) {
        var wouldRequire = $super(search);
        return (this.getParam("requiresDispatch") == "True" && wouldRequire);
    },

    /** 
     * see comment on DispatchingModule.requiresTransformedResults
     */
    requiresTransformedResults: function() {
        return true;
    }

});