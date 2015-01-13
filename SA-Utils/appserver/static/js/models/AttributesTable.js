define([
     "jquery",
     "underscore",
     "backbone"
], function(
     $,
     _,
     Backbone
) {
     return Backbone.Model.extend({
          url: function() {
            return Splunk.util.make_url(
                    "/custom/SA-Utils/identitymapper" +
                    "/reverse_lookup?value="+ this.value +
                    "&constraint_fields=" + this.constraint_fields +
                    "&constraint_method="+ this.constraint_method
                );
          },
          initialize: function(attributes, options) {
            this.collection = options.swimlanes;
            this.collection.on("reset", _.bind(this.fetchAll, this));
            this.fieldName = this.collection.prefs.field_name;
          },
          fetchAll: function() {
            this.collection.each(function(model) {
              var constraint_method = model.get("constraint_method"), 
                  constraint_fields = model.get("constraint_fields"),
                  onFetch = this.onFetch,
                  value = model.pref.get('entity_name');

              if ((typeof value !== "undefined") && constraint_fields && constraint_method) {
                  this.constraint_method = constraint_method;
                  this.constraint_fields = constraint_fields;
                  this.value = value;

                  var that = this;
                  this.fetch({
                    success: function(m, resp) {
                      if (resp.count === 0) { 
                          that.trigger("entity:notFound");
                      }
                      onFetch(resp, model); 
                    },
                    error: function(m, resp) {
                      that.trigger("entity:invalid");
                    }
                  });
              } else if (typeof value === "undefined") {
                  this.trigger("entity:undefined");
                  model.trigger("entity:undefined");
              }
            }, this);
          },
          onFetch: function(resp, model) {
              model.set('constraints', resp.clauses[0]);
          },
          parse: function(result) {
              this.clear();
              _.each(result.records[0], function(val, key) {
                  var existing = this.get(key);
                  if (existing) {
                    this.set(key, _.union(existing, val));
                  } else {
                    this.set(key, val);
                  }
              }, this);
          },
          setNewEntity: function(entity) {
              var pref = this.collection.getPref();
              pref.set("identity", entity);
              pref.set("entity_name", entity);
              this.collection.prefs.urlSync.setEntityName(entity);
              pref.save();

              this.trigger("setEntityName");
              this.fetchAll();
          }
     });
});
