// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.

Splunk.Module.JobSpinner = $.klass(Splunk.Module.DispatchingModule, {

    initialize: function($super, container) {
        $super(container);
        this.logger = Sideview.utils.getLogger();
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
        this.hide();
    },

    resetUI: function() {},

    displayFrame: function(p) {
        //16 frames,  plus the empty frame. 
        //17 * 26 = 416 px total
        var pos = - Math.round(p*16) * 26;
        this.container.css("background-position", "0px " + pos + "px");
    },
    onContextChange: function() {
        var context = this.getContext();
        var search  = context.get("search");
        if (!search.job.isDone())  this.show();
    },

    onJobProgress: function() {
        var context = this.getContext();
        var search  = context.get("search");
        this.displayFrame(search.job.getDoneProgress());
    },
    onJobDone: function() {
        this.hide();
    }

});