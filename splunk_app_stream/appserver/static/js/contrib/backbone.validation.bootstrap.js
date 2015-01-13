(function(root, factory) {
    // Set up Backbone-associations appropriately for the environment. Start with AMD.
    if (typeof define === 'function' && define.amd) {
        define(['underscore', 'backbone'], function(_, Backbone) {
            // Export global even in AMD case in case this script is loaded with
            // others that may still expect a global Backbone.
            return factory(root, Backbone, _);
        });

    // Next for Node.js or CommonJS.
    } else if (typeof exports !== 'undefined') {
        var _ = require('underscore'),
            Backbone = require('backbone');
        factory(root, Backbone, _);
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = Backbone;
        }
        exports = Backbone;

    // Finally, as a browser global.
    } else {
        factory(root, root.Backbone, root._);
    }

}(this, function(root, Backbone, _) {

_.extend(Backbone.Validation.callbacks, {
  valid: function(view, attr, selector){
    var control = view.$('[' + selector + '=' + attr + ']');
    var group = control.parents(".control-group");
    group.removeClass("error");

    if (control.data("error-style") === "tooltip"){
      // CAUTION: calling tooltip("hide") on an uninitialized tooltip
      // causes bootstraps tooltips to crash somehow...
      if (control.data("tooltip"))
        control.tooltip("hide");
    }
    else if (control.data("error-style") === "inline"){
      group.find(".help-inline.error-message").remove();
    }
    else{
      group.find(".help-block.error-message").remove();
    }
  },
  invalid: function(view, attr, error, selector) {
    var control = view.$('[' + selector + '=' + attr + ']');
    var group = control.parents(".control-group");
    group.addClass("error");

    if (control.data("error-style") === "tooltip"){
      var position = control.data("tooltip-position") || "right";
      control.tooltip({
        placement: position,
        trigger: "manual",
        title: error
      });
      control.tooltip("show");
    }
    else if (control.data("error-style") === "inline"){
      if (group.find(".help-inline").length === 0){
        group.find(".controls").append("<span class=\"help-inline error-message\"></span>");
      }
      var target = group.find(".help-inline");
      target.text(error);
    }
    else {
      if (group.find(".help-block").length === 0) {
        group.find(".controls").append("<p class=\"help-block error-message\"></p>");
      }
      var target = group.find(".help-block");
      target.text(error);
    }
  }
});
}));