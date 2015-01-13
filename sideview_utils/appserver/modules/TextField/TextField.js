// Copyright (C) 2010-2011 Sideview LLC.  All Rights Reserved.

Splunk.Module.TextField= $.klass(Splunk.Module, {

    invariantKeys: {
        9:  "TAB",
        13: "ENTER",
        27: "ESCAPE",
        40: "DOWN_ARROW",
        16: "SHIFT",
        17: "CTRL",
        18: "ALT",

        33: "PGUP",
        34: "PGDN",
        35: "END",
        36: "HOME",
        37: "LEFT_ARROW",
        38: "UP_ARROW",
        39: "RIGHT_ARROW"
        
        

    },


    initialize: function($super, container) {
        $super(container);
        
        this.logger = Sideview.utils.getLogger();
        this.name = this.getParam("name");
        if (this.name=="search") alert(this.moduleType + " Error - you do not want to set the name param to 'search' as this will disrupt how searches and search results are passed downstream.");

        if (this.getParam("float")) {
            $(container).css("margin-right", "10px");
            $(container).css("float", this.getParam("float"));
        }
        
        this.input = $('input', this.container)
            // chrome does really weird thing when you use the back button.
            // nonsensical values appear from nowhere. Null them out.
            .val(this.getParam("default"))
            .bind("keydown",  this.onKeyDown.bind(this))
            .bind("keyup", this.onKeyUp.bind(this))
            .bind("blur",  this.onBlur.bind(this))
            .bind('paste', this.onPaste.bind(this));
        
        if (this.getParam("customBehavior")) {
            Sideview.utils.applyCustomBehavior(this);
        }
    },

    resetToDefault: function() {
        this.input.val(this.getParam("default"));
    },

    resetUI: function() {},
    

    clearURLLoader: function(context) {
        context = context || this.getContext();
        // only do this once 
        if (!this.hasClearedURLLoader && context.has("sideview.onSelectionSuccess")) {
            var callback = context.get("sideview.onSelectionSuccess");
            callback(this.name, this);
            this.hasClearedURLLoader = true;
        }
    },

    setToContextValue: function(context) {
        this.input.val(context.get(this.name) || "");
    },

    /**
     * called when a module from upstream changes the context data
     */
    onContextChange: function() {
        var context = this.getContext();
        if (context.has(this.name)) {
            this.setToContextValue(context);
            this.clearURLLoader(context);
        } 
        // if the label param contains $foo$ tokens we rewrite the label accordingly
        if (this.getParam("label") && this.getParam("label").indexOf("$")!=-1) {
            context.set("name", this.getParam("name"));
            var labelTemplate = this.getParam("label");
            $("label", this.container).text(Sideview.utils.replaceTokensFromContext(labelTemplate, context));
        }
    },

    /**
     * called when a module from downstream requests new context data
     */
    getModifiedContext: function() {
        var context = this.getContext();
        var template = this.getParam("template");
        var rawValue = this.input.val() || "";

        context.set(this.name + ".element", this.input);
        // we do not backslash escape rawValue, because we assume it is NOT 
        // destined for searches.  rawValue is for QS args and for labels.
        context.set(this.name + ".rawValue", rawValue);
        
        var value = Sideview.utils.escapeBackslashes(rawValue);
        var templatizedValue = Sideview.utils.templatize(context, template, this.name, value);

        context.set(this.name + ".value", templatizedValue);
        context.set(this.name, templatizedValue);
        return context;
    },

    /**
     * These are designed to be implemented using a customBehavior.
     */
    validate: function() {return true;},
    onValidationPass: function() {},
    onValidationFail: function() {},

    isReadyForContextPush: function($super) {
        if (!$super()) return false;
        var validation = this.validate();
        if (validation) this.onValidationPass();
        else this.onValidationFail();
        return validation;
    },


    onPassiveChange: function() {
        var context = this.getContext();
        if (context.has("sideview.onEditableStateChange")) {
            var currentValue = this.input.val();
            if (this.lastEdit==null || currentValue!=this.lastEdit) {
                var callback = context.get("sideview.onEditableStateChange");
                callback(this.name, this.input.val(), this);
                this.lastEdit = currentValue;
            }
        }
    },

    onBlur: function(evt) {
        this.onPassiveChange();
    },

    onPaste: function(evt) {
        // if it's ctrl-V the onKeyUp will have taken care of it. 
        // this is to take care of right-click and 'Edit' menu pastes.
        if(!evt.keyCode) {
            setTimeout(function() {
                this.onPassiveChange();
                this.pseudoPush();
            }.bind(this), 0);
        }
    },

    onKeyDown: function(evt) {
        //this.logger.debug("onKeyDown " + this.input.val());
        // detect enter key
        if (evt.keyCode == 13) {
            evt.preventDefault();
            //this.logger.debug("onKeyDown calling push " + this.input.val());
            this.onPassiveChange();
            this.pushContextToChildren();
            return false;
        }
    },

    onKeyUp: function(evt) {
        if (!this.invariantKeys.hasOwnProperty(evt.keyCode)) {
            this.pseudoPush();
        } else {
            //this.logger.debug('no pseudoPush because this was a ' + this.invariantKeys[evt.keyCode]);
        }
    },

    pseudoPush: function() {
        // Note that setChildContextFreshness does basically nothing when you 
        // have a dispatched search.  Nate was right. There's a catch-22 here.
        // see comments at the end of the file. 
        this.setChildContextFreshness(false);
        var modCon = this.getModifiedContext();
        var elementKey = this.name + ".element";
        var element = modCon.get(elementKey);
        var key = this.name;
        var value = modCon.get(key);
        var rawKey = this.name + ".rawValue";
        var rawValue = modCon.get(rawKey);
        this.withEachDescendant(function (module) {
            if (module.baseContext) {
                var modElt = module.baseContext.get(elementKey)
                if (modElt && modElt.attr && modElt.attr("id") == element.attr("id")) {
                    module.baseContext.set(key,value);
                    module.baseContext.set(rawKey,rawValue);
                } else return false;
            }
        });
    },
    

    pushContextToChildren: function($super, explicitContext) {
        /* see notes in Checkbox.js */
        this.withEachDescendant(function(module) {
            module.dispatchAlreadyInProgress = false;
        });
        return $super(explicitContext);
    },

    /**
     * called when a module receives new context data from downstream. 
     * This is rare, and only happens in configurations where custom behavior
     * logic is sending values upstream during interactions, for TextField
     * and Pulldown instances to 'catch'. 
     */
    applyContext: function(context) {
        if (!this.isPageLoadComplete()) {
            this.logger.error(this.moduleType + " is not designed to work with the oldschool Search resurrection system.");
        }
        if (this.isPageLoadComplete() && context.has(this.name)) {
            this.setToContextValue(context);
            this.onPassiveChange();
            context.remove(this.name);
            if (Sideview.utils.contextIsNull(context)) {
                this.pushContextToChildren();
                // stop the upward-travelling context.
                return true;
            }
         }
     }

});

// many cases have been improved with pseudoPush, but a core Catch 22 remains. 
//
// Say you have TextField A, Search, Pulldown, TextField B, 
// SubmitButton. The user changes a value in TextField A, then 
// focuses into TextField B and hits return. 
// the pseudoPush will catch it and A's change is incorporated. All is well. 
//
// Now say you have TextField A, TextField B, a customBehavior C that 
// creates a third key out of those two, and a SubmitButton. 
// Change in A, then focus away and click the button. 
// the staleness flag will make the customBehavior logic rerun. All is well. 
//
// Now say you have TextField A, TextField B, Search, Pulldown, 
// CustomBehavior C, SubmitButton  (phew). 
// and lets say the Pulldown has already been populated by autoRun.
// user types into TextField A, then clicks submitButton. 
// the pseudoPush will have pushed the A value all the way down. 
// but the staleness check that looks up from the button wont be able to 
// get past the dispatched search that the Pulldown is using. 
// end result is that A's change is not incorporated.
// 