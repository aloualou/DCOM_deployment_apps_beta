define('app/components/investigator', 
    function (require, exports, module) {
      var _ = require("underscore"),
        d3 = require("d3"),
        Backbone = require("backbone"),
        // etc
        $ = require("jquery"),
        SJS = require("splunkjs/mvc"),
        SearchManager = require("splunkjs/mvc/searchmanager"),
        // collections
        Prefs = require("app/collections/Prefs"),
        SignBoardResults = require("app/collections/SignBoardResults"),
        Swimlanes = require("app/collections/Swimlanes"),
        Times = require("collections/services/data/ui/Times"),
        // models
        Application = require("models/Application"),
        AppLocal = require("models/services/AppLocal"),
        AttributesTable = require("app/models/AttributesTable"),
        TimeRange = require("app/models/TimeRange"),
        TimeRangeLinegraph = require("app/models/TimeRangeLinegraph"),
        User = require("models/services/authentication/User"),
        // views
        SwimlanesView = require("app/views/SwimlanesView"),
        SwimlaneModalView = require("app/views/SwimlaneModalView"),
        SignBoardView = require("app/views/SignBoardView"),
        TimeRangeLinegraphView = require("app/views/TimeRangeLinegraphView"),
        TimeRangePickerView = require("app/views/TimeRangePickerView"),
        //TimeRangePickerView = require("views/shared/timerangepicker/Master"),
        TimeRangeViewportView = require("app/views/TimeRangeViewportView"),
        AttributesTableView = require("app/views/AttributesTableView"),
        InvestigatorInputView = require("app/views/InvestigatorInputView"),
        // scaffolding
        SVGDefsTemplate = require("contrib/text!app/templates/SVGDefs.html"),
        InvestigatorInputTemplate = require("contrib/text!app/templates/InvestigatorInput.html"),
        SwimlanesContainerOuterTemplate = require("contrib/text!app/templates/SwimlanesContainerOuter.html"),
        SwimlaneModalTemplate = require("contrib/text!app/templates/SwimlaneModal.html"),
        SwimlaneMouseoverTemplate = require("contrib/text!app/templates/SwimlaneMouseover.html"),
        TimeRangeMouseoverTemplate = require("contrib/text!app/templates/TimeRangeMouseover.html"),
        TimeRangeContainerTemplate = require("contrib/text!app/templates/TimeRangeContainer.html"),
        SignBoardContainerTemplate = require("contrib/text!app/templates/SignBoardContainer.html"),
        EditSwimlanesContainerTemplate = require("contrib/text!app/templates/EditSwimlanesContainer.html"),
        SwimlanesContainerTemplate = require("contrib/text!app/templates/SwimlanesContainer.html"),
        AttributesTableContainerTemplate = require("contrib/text!app/templates/AttributesTableContainer.html"),
        Managers = require('app/collections/Managers');

      var Investigator = Backbone.View.extend({
        moduleId: 'investigator',
        className: 'investigator',
        initialize: function(options) {
          var app_name = options.app_name,
              field_name = options.field_name || 'identity',
              fieldNameCap = field_name.charAt(0).toUpperCase() + field_name.slice(1),
              max_concurrency = options.max_concurrency || 2,
              view_name = options.view_name,
              id = options.id,
              leftPadding = 60,
              linegraphHeight = 50,
              rightPadding = 60,
              timeRangeHeight = 95,
              timeRangeWidth = 843,
              containerEl = options.el,
              swimlanesContainerEl = '#swimlanesContainer',
              outerTimeRangeContainerEl = '.timeRangeContainer',
              outerTimeRangeLineChartEl = '.lineChart',
              outerTimeRangeSvgEl = 'svg#timeRange',
              signBoardContainerEl = '.signBoardContainer',
              swimlaneModalCollectionEl = '#swimlaneCollectionPicker',
              swimlaneModalEditEl = '.editSwimlanes',
              swimlaneModalEl = '#swimlaneModal',
              swimlaneModalSwimlaneEl = '#swimlanePickers',
              swimlanesSvgEl = 'svg#swimlanes',
              timeRangePickerEl = '#timeRangePicker',
              attributesTableEl = '#attributesTable',
              investigatorInputEl = '#investigatorInput',
              application = new Application(),
              appLocal = new AppLocal(),
              user = new User(),
              swimlanesManagers = new Managers([], {
                  max_concurrency: max_concurrency
              }),
              linegraphManagers = new Managers([], {
                max_concurrency: 1
              }),
              prefs = new Prefs([],{
                app_name: app_name, 
                changes: [
                  'change:selected',
                  'change:lane_prefs',
                  'change:earliest',
                  'change:latest'
                ],
                field_name: field_name,
                id: id,
                view_name: view_name
              }),
              signBoardResults = new SignBoardResults([], {
                prefs: prefs
              }),
              timeRange = new TimeRange({
                app_name: app_name, 
                earliest: '@d',
                latest: 'now',
                prefs: prefs,
                view_name: view_name
              }),
              swimlanes = new Swimlanes([],{
                app_name: app_name, 
                id: id,
                max_concurrency: max_concurrency,
                prefs: prefs,
                sign_board: signBoardResults,
                time_range: timeRange,
                view_name: view_name,
                managers: swimlanesManagers
              }),
              attributesTable = new AttributesTable({}, {
                swimlanes: swimlanes
              }),
              times = new Times(),
              timeRangeLinegraphView,
              timeRangeSvg,
              timeRangeLinegraph;

          Backbone.emulateHTTP = true;
          Backbone.emulateJSON = true; 

          // times.conf won't fetch itself
          times.fetch();

          $(containerEl)
              .append(_.template(SwimlaneMouseoverTemplate))
              .append(_.template(TimeRangeMouseoverTemplate))
              .append(_.template(InvestigatorInputTemplate, 
                  {entityName: fieldNameCap}))
              .append(_.template(AttributesTableContainerTemplate))
              .append(_.template(SwimlanesContainerOuterTemplate));
          $(swimlanesContainerEl)
              .append(_.template(EditSwimlanesContainerTemplate))
              .append(_.template(SwimlanesContainerTemplate))
              .append(_.template(SignBoardContainerTemplate))
              .append(_.template(SwimlaneModalTemplate)) 
              .append(_.template(
                  TimeRangeContainerTemplate,
                  {
                    height: timeRangeHeight,
                    outer_translate: 'translate('+[leftPadding, 0] +')',
                    translate: 'translate('+ [0, linegraphHeight] +')',
                    width: timeRangeWidth+leftPadding+rightPadding
                  }
              ))
              .append(_.template(SVGDefsTemplate));

          timeRangeSvg = d3.select(outerTimeRangeSvgEl); 

          new InvestigatorInputView({
              model: attributesTable,
              el: $(investigatorInputEl)
          });

          new AttributesTableView({
              model: attributesTable,
              el: $(attributesTableEl)
          });

          new SwimlanesView({
              collection: swimlanes,
              el: swimlanesSvgEl,
              model: timeRange
          });

          new SwimlaneModalView({
              el: $(swimlaneModalEl), 
              collection: swimlanes,
              collections_el: swimlaneModalCollectionEl,
              swimlanes_el: swimlaneModalSwimlaneEl,
              edit_el: swimlaneModalEditEl
          });

          timeRangeLinegraph = new TimeRangeLinegraph({
            managers: linegraphManagers,
            swimlanes: swimlanes,
            timeRange: timeRange
          });
         
          timeRangeLinegraphView = new TimeRangeLinegraphView({
              el: $(timeRangeSvg.select(outerTimeRangeLineChartEl).node()),
              height: linegraphHeight,
              model: timeRangeLinegraph,
              svg: timeRangeSvg,
              time_range: timeRange,
              width: timeRangeWidth
          });

          new TimeRangeViewportView({
              clipId: timeRangeLinegraphView.getClipId(),
              el: $(timeRangeSvg.select(outerTimeRangeContainerEl).node()),
              height: timeRangeHeight,
              model: timeRange,
              svg: timeRangeSvg,
              width: timeRangeWidth
          });

          new TimeRangePickerView({
              collection: times,
              dialogOptions: {
                  showPresets: true,
                  showPresetsRelative: true,
                  showPresetsRealTime: false,
                  showPresetsAllTime: false,
                  showCustomRealTime: false,
                  showCustomRelative: false,
                  enableCustomAdvancedRealTime: false
              },
              el: $(timeRangePickerEl),
              model: {
                  application: application,
                  appLocal: appLocal,
                  timeRange: timeRange,
                  user: user
              }
          }).render();

          new SignBoardView({
              el: $(signBoardContainerEl),
              collection: signBoardResults,
              prefs: prefs
          });
          
          prefs.fetch({reset: true});

        },
        render: function() {  
            return this; 
        }

      });

    return Investigator;

});
