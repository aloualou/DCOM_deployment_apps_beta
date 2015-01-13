define([
    'jquery',
    'underscore',
    'backbone',
    'models/TimeRange',
    'entityUtils',
    'util/time_utils',
    'splunk/time/TimeUtils',
    'splunk/time/DateTime',
    'splunkjs/mvc',
    'd3'
], function(
    $,
    _,
    Backbone,
    TimeRange,
    util,
    time_utils,
    TimeUtils,
    DateTime,
    SJS,
    d3
) {
    return TimeRange.extend({
        defaults: {
            changes: [
              'change:earliest',
              'change:latest',
              'change:inner_earliest',
              'change:inner_latest',
              'change:outerTimeRange',
              'change:innerTimeRange'
            ],
            earliest: '@d',
            enableRealTime: false,
            latest: 'now',
            innerPos: {
                left: 0,
                right: 100
            },
            minResolution: 1.65,
            outerTimeRange: {
                units: 'hours'
            },
            timeScale: d3.time.scale().range([0,100]),
            totalInnerTime: {
                minutes: 0,
                hours: 0,
                days: 0
            }
        },
        msPerDay: 86400000,
        msPerHour: 3600000,
        msPerMinute: 60000,
        pref_id: 'timeRange',
        initialize: function() {
            TimeRange.prototype.initialize.apply(this, arguments);

            this.app_name = this.get('app_name');
            this.prefs = this.get('prefs');
            this.view_name = this.get('view_name');

            this.timeScale = this.get('timeScale');
            this.tokens = SJS.Components.getInstance("default");

            this.prefs.on('reset', _.bind(this.onPrefsReset, this));
        },
        onPrefsReset: function() {
            this.pref = this.prefs.getPref(this.pref_id);

            this.set({
                earliest: this.pref.get('earliest') || this.get('earliest'),
                latest: this.pref.get('latest') || this.get('latest')
            });

            this.callSync();
            this.trigger('prefs_loaded');

            this.pref.on('sync', _.bind(this.setTimeTokens, this));
            this.on('change:earliest change:latest', _.bind(this.callSync, this));
        },
        callSync: function() {
            this.sync(
              'create',
              this, 
              {
                success: _.bind(this.onSync, this),
                error: _.bind(this.onSyncError, this)
              }
            );
        },
        onSyncError: function() {
            console.error('there was a problem fetching times: ', arguments);
        },
        validate: function(attrs, options){
            if(attrs.earliest === undefined || attrs.latest === undefined){
                return "either earliest or latest is undefined";
            }
            if(attrs.earliest[0] === 'r' && attrs.earliest[1] === 't'){
                return "invalid time range: realtime";
            }
            if(attrs.latest[0] === 'r' && attrs.latest[1] === 't'){
                return "invalid time range: realtime";
            }
            if(attrs.earliest === 0){
                return "invalid time range: all time";
            }
        },
        onSync: function(model, values, options) {
            var innerTimeRange = this.pref.get('innerTimeRange') || {},
                outerTimeRange = {},
                range,
                innerTimeScale,
                isValid,
                updateInner = false;

            // SOLNESS-4606 - TimeRange model ignores client TZ when
            // calculating earliest_date and latest_date, workaround using ISOs
            outerTimeRange.earliest_date = time_utils.jsDateToSplunkDateTimeWithMicroseconds(
                  time_utils.isoToDateObject(values.earliest_iso)
            ).date;

            outerTimeRange.latest_date = time_utils.jsDateToSplunkDateTimeWithMicroseconds(
                  time_utils.isoToDateObject(values.latest_iso)
            ).date;

            if(innerTimeRange.earliest_date === undefined || innerTimeRange.earliest_date === null){
                updateInner = true;
                innerTimeRange.earliest_date = outerTimeRange.earliest_date;
            } else {
                innerTimeRange.earliest_date = new Date(innerTimeRange.earliest_date);
            }

            if(innerTimeRange.latest_date === undefined || innerTimeRange.latest_date === null){
                updateInner = true;
                innerTimeRange.latest_date = outerTimeRange.latest_date;
            } else {
                innerTimeRange.latest_date = new Date(innerTimeRange.latest_date);
            }

            // In case there is no duration between earliest and latest
            if(innerTimeRange.earliest_date.getTime() === innerTimeRange.latest_date.getTime()){
                innerTimeRange.earliest_date = new Date(innerTimeRange.earliest_date.getTime()-(60*1000));
            }

            if(updateInner) {
                this.pref.set({
                    innerTimeRange: innerTimeRange
                }, {silent: true});
                this.pref.save();
            }

            range = (innerTimeRange.latest_date.getTime()-innerTimeRange.earliest_date.getTime())/1000;
            outerRange = (outerTimeRange.latest_date.getTime()-outerTimeRange.earliest_date.getTime())/1000;

            innerTimeScale = d3.time.scale()
                .range([0,79])
                .domain([innerTimeRange.earliest_date, innerTimeRange.latest_date]); 

            isValid = this.set({
                innerTimeRange: innerTimeRange,
                innerTimeScale: innerTimeScale,
                outerTimeRange: outerTimeRange,
                span: Math.round(range/80, 0).toString() + 's',
                outerSpan: Math.round(outerRange/80, 0).toString() + 's'
            }, {validate: true});

            if(this.validationError === null){
                this.onRangeChange();
                this.setAbsoluteRanges();
                this.trigger('change:outerTimeRange');
                if(updateInner){
                    this.trigger('change:innerPos');
                }
            } else {
                console.error('timerange validation error');
            }
        },
        onRangeChange: function() {
            var innerTimeRange = this.get('innerTimeRange') || this.get('outerTimeRange');
            this.pref.save({
                earliest: this.get('earliest'),
                latest: this.get('latest')
            });
            this.tokens.set({
                earliest: this.get('earliest'),
                latest: this.get('latest')
            });
        }, 
        rescaleGripperPositions: function(){
            var outerTimeRange = this.get('outerTimeRange'),
                innerToPos = d3.time.scale()
                  .domain([outerTimeRange.earliest_date, outerTimeRange.latest_date])
                  .range([0,100]),
                innerTimeRange = this.get('innerTimeRange'),
                left = Math.min(100, Math.max(0, innerToPos(innerTimeRange.earliest_date))),
                right = Math.min(100, Math.max(0, innerToPos(innerTimeRange.latest_date)));

            this.updateGrippers({
                left:left,
                right:right
            });
        },
        updateGrippers: function(pos){
            var newPos = {},
                innerTimeRange = {},
                innerTimeScale,
                movingBoth,
                range;

            if(pos.left !== undefined && pos.right !== undefined){
                movingBoth = true;
            } else {
                movingBoth = false;
            }

            _.extend(newPos, this.get('innerPos'), pos);
            this.snapToMins(1, newPos, movingBoth);

            if(newPos.left < newPos.right){
                this.set('swapped', false);
                innerTimeRange.earliest_date = this.timeScale.invert(newPos.left);
                innerTimeRange.latest_date = this.timeScale.invert(newPos.right);
            } else {
                this.set('swapped', true);
                innerTimeRange.earliest_date = this.timeScale.invert(newPos.right);
                innerTimeRange.latest_date = this.timeScale.invert(newPos.left);
            }
            
            if(innerTimeRange.earliest_date.getTime() === innerTimeRange.latest_date.getTime()){
                innerTimeRange.earliest_date = new Date(innerTimeRange.earliest_date.getTime()-(60*1000));
            }

            range = (innerTimeRange.latest_date.getTime()-innerTimeRange.earliest_date.getTime())/1000;
            innerTimeScale = d3.time.scale()
                .range([0,79])
                .domain([innerTimeRange.earliest_date, innerTimeRange.latest_date]); 

            this.set({
                innerPos: newPos,
                innerTimeRange: innerTimeRange,
                totalInnerTime: this.calculateTotalInner(innerTimeRange),
                innerTimeScale: innerTimeScale,
                span: Math.round(range/80, 0).toString() + 's'
            });

            this.pref.set({
                innerTimeRange: innerTimeRange
            }, {silent: true});

            this.pref.debounceSave();
        },
        clamp: function(pos){
            var range = this.timeScale.range();

            pos.left = Math.max(range[0], Math.min(range[1], pos.left));
            pos.right = Math.max(range[0], Math.min(range[1], pos.right));
        },
        snapToMins: function(numMins, pos, movingBoth){
            var earliest = this.timeScale.invert(pos.left),
                latest = this.timeScale.invert(pos.right),
                outerTimeRange = this.get('outerTimeRange'),
                earliestRem = earliest.getMinutes() % numMins,
                latestRem = latest.getMinutes() % numMins,
                newPos = {},
                range = this.timeScale.range(),
                width = Math.abs(pos.right - pos.left),
                epsilon = 0.1,
                earliestMin, latestMin,
                left, right;

            if(pos.left > range[0] && pos.left < range[1]){
                earliestMin = earliest.getMinutes() - earliestRem;
                earliest.setMinutes(earliestMin);
                earliest.setSeconds(0);
                newPos.left = this.timeScale(Math.max(outerTimeRange.earliest_date, earliest));
            } else {
                newPos.left = pos.left;
            }

            if(movingBoth){
                /*
                Don't really need to snap the right gripper
                If this did snap to the right, it would
                create mis-sized elements on the right.
                */
                newPos.right = newPos.left + width;
            } else {
                if(pos.right > range[0] && pos.right < range[1]){
                    latestMin = latest.getMinutes() - latestRem;
                    latest.setMinutes(latestMin);
                    latest.setSeconds(0);
                    newPos.right = this.timeScale(Math.min(outerTimeRange.latest_date, latest));
                } else {
                    newPos.right = pos.right;
                }
            }

            // This may be overly cautious, but sometimes
            // snapping can overstep the boundaries
            this.clamp(newPos);

            pos.left = newPos.left;
            pos.right = newPos.right;

        },
        setTimeTokens: function() {
            var innerTimeRange = this.get('innerTimeRange'),
                span = this.get('span');
            if (innerTimeRange) {
                this.tokens.set({
                    inner_earliest: innerTimeRange.earliest_date,
                    inner_latest: innerTimeRange.latest_date,
                    span: span
                });
            }
        },
        // TODO: remove this when new solution is in place
        enforceMinimumResolution: function(pos, newPos){
            if(newPos.right - newPos.left < this.minResolution){
                if(pos.left !== undefined){
                    newPos.left = newPos.right - this.minResolution;
                } else if (pos.right !== undefined){
                    newPos.right = newPos.left + this.minResolution;
                }
            }
            return newPos;
        },
        setAbsoluteRanges: function() {
            var outerTimeRange = {
                  earliest_date: this.get('outerTimeRange').earliest_date,
                  latest_date: this.get('outerTimeRange').latest_date
                },
                innerTimeRange = this.get('innerTimeRange'), 
                earliest = this.dateTimeFactory(outerTimeRange.earliest_date),
                latest = this.dateTimeFactory(outerTimeRange.latest_date);

            outerTimeRange.units = this.getUnits(earliest, latest);
            outerTimeRange.duration = TimeUtils.subtractDates(latest, earliest);

            this.timeScale.domain([outerTimeRange.earliest_date, outerTimeRange.latest_date]);

            this.set({
                innerTimeRange: innerTimeRange,
                outerTimeRange: outerTimeRange,
                totalInnerTime: this.calculateTotalInner({
                   earliest_date: innerTimeRange.earliest_date,
                   latest_date: innerTimeRange.latest_date
                })
            });
            this.rescaleGripperPositions();
        },
        calculateTotalInner: function(innerTimeRange){
            var start,
                end,
                totalHours,
                totalDays,
                totalMinutes,
                remainder,
                dateDuration;

            start = new Date(innerTimeRange.earliest_date);
            end = new Date(innerTimeRange.latest_date);

            dateDuration = end - start;
            totalDays = dateDuration / this.msPerDay;
            if(totalDays < 1){
                totalDays = 0;
            } else {
                totalDays = util.roundTo(totalDays, 1);
            }
            dateDuration -= totalDays * this.msPerDay;

            totalHours = dateDuration / this.msPerHour;
            if(totalHours < 1){
                totalHours = 0;
            } else {
                totalHours = util.roundTo(totalHours, 1);
            }
            dateDuration -= totalHours * this.msPerHour;
            totalMinutes = dateDuration / this.msPerMinute;
            if(totalMinutes < 1){
                totalMinutes = 0;
            } else {
                totalMinutes = util.roundTo(totalMinutes, 1);
            }
            dateDuration -= totalMinutes * this.msPerMinute;

            return {
                minutes: totalMinutes,
                hours: totalHours,
                days: totalDays
            };
        },
        dateTimeFactory: function(date){
            return new DateTime(
                date.getUTCFullYear(),
                date.getUTCMonth() + 1,
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds(),
                date.getUTCMilliseconds() * 1000
            );
        },
        getTimeFormat: function(timeRange){
            var formatStr;

            if(timeRange === undefined){
                return d3.time.format('%H:%M');
            }

            if(timeRange.years >= 1){
                formatStr = '%e/%m/%Y';
            } else if (timeRange.days >= 5){
                formatStr = '%m/%d';
            } else if(timeRange.days >= 3){
                formatStr = '%m/%d %H:%M';
            } else if(timeRange.days > 1){
                formatStr = '%H:%M';
            } else if(timeRange.days <= 1){
                formatStr = '%H:%M:%S';
            }

            return d3.time.format(formatStr);
        },
        getUnits: function(earliest, latest){
            var duration = TimeUtils.subtractDates(latest, earliest);
            if (duration.years > 0){
                return "years";
            }
            if (duration.months > 0){
                return "months";
            }
            if (duration.days > 1){
                return "days";
            }

            return "hours";
        }
    });
});
