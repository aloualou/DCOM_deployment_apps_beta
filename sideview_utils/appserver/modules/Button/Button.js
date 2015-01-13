// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.

Splunk.Module.Button = $.klass(Splunk.Module, {
    
    initialize: function($super, container) {
        $super(container);
        this.logger = Sideview.utils.getLogger();
        this.allowSoftSubmit = Splunk.util.normalizeBoolean(this.getParam("allowSoftSubmit"));
        this.allowAutoSubmit = Splunk.util.normalizeBoolean(this.getParam("allowAutoSubmit"));
        this.open = this.allowSoftSubmit;
        this.useMetaKey = /mac/.test(navigator.userAgent.toLowerCase())
        var selector = (this.getParam("label")) ? "button.splButton-primary" : "input.searchButton";
        this._submitButton = $(selector, this.container);
        this._submitButton.click(function(evt) {
            this.open = true;
            this.modifierKeyHeld = this.isModifierKeyHeld(evt);
            this.pushContextToChildren(null, true);
            this.modifierKeyHeld = false;
            this.open = this.allowSoftSubmit;
        }.bind(this));
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
    },

    resetUI: function() {},

    isModifierKeyHeld: function(evt) {
        return this.useMetaKey ? evt.metaKey : evt.ctrlKey;
    },

    isReadyForContextPush: function() {
        // if we're still loading the page and we allowAutoSubmit, then yes.
        if (this.allowAutoSubmit && !this.isPageLoadComplete()) {
            return true;
        }
        return this.open;
    },

    getModifiedContext: function() {
        var context = this.getContext();
        if (this.modifierKeyHeld) context.set("click.modifierKey", this.modifierKeyHeld);
        return context;
    },

    _fireDispatchSuccessHandler: function($super,runningSearch) {
        this.open = true;
        var retVal = $super(runningSearch);
        this.open = this.allowSoftSubmit;
        return retVal;
    }
});
