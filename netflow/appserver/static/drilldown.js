require(['jquery','underscore','splunkjs/mvc','util/console','splunkjs/mvc/simplexml/ready!'], function($, _, mvc, console) {
    var drilldown = function(masterID, slaveIDs, token, column, slavesOfSlavesIDs) {
        if (!column) {
            column = token;
        }

        if (!slavesOfSlavesIDs) {
            slavesOfSlavesIDs = [];
        }
        
        var master = mvc.Components.get(masterID);
        
        var slaves = [];
        var slavesOfSlaves = [];
        var i;
        for(i = 0; i < slaveIDs.length; i++) {
            slaves.push(mvc.Components.get(slaveIDs[i]));
        }
        for(i = 0; i < slavesOfSlavesIDs.length; i++) {
            slavesOfSlaves.push(mvc.Components.get(slavesOfSlavesIDs[i]));
        }

        var unsubmittedTokens = mvc.Components.get('default');
        var submittedTokens = mvc.Components.get('submitted');

        if (!submittedTokens.has(token)) {
            for (i = 0; i < slaves.length; i++) {
                slaves[i].$el.parents('.dashboard-panel').hide();
            }
            for (i = 0; i < slavesOfSlaves.length; i++) {
                slavesOfSlaves[i].$el.parents('.dashboard-panel').hide();
            }
        }

        submittedTokens.on('change:' + token, function() {
            if (!submittedTokens.get(token)) {
                for (i = 0; i < slaves.length; i++) {
                    slaves[i].$el.parents('.dashboard-panel').hide();
                }
            } else {
                for (i = 0; i < slaves.length; i++) {
                    slaves[i].$el.parents('.dashboard-panel').show();
                }
            }
            for (i = 0; i < slavesOfSlaves.length; i++) {
                slavesOfSlaves[i].$el.parents('.dashboard-panel').hide();
            }
        });

        if(master) {
            master.on('click', function(e) {
                e.preventDefault();
                var newValue = e.data['row.' + column];
                unsubmittedTokens.set(token, newValue);
                submittedTokens.set(token, newValue);
                submittedTokens.trigger('change:' + token);
            });
        }
        
        $("button.submit").on('click', function() {
            if(submittedTokens.has(token)) {
                unsubmittedTokens.set(token, "");
                for (i = 0; i < slaves.length; i++) {
                    slaves[i].$el.parents('.dashboard-panel').hide();
                }
            }
        });
    };

    var dashboard = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
    switch (dashboard) {
        case 'traffic_by_protocol':
            drilldown('table_1_1', ['table_2_1'], 'Device');
            break;
        case 'cisco_top_bandwidth_consumers':
        case 'cisco_top_connectors':
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'User IP');
            break;
        case 'cisco_top_destinations':
        case 'connections_by_destination':
        case 'traffic_by_destination':
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'Destination IP');
            break;
        case 'cisco_top_violators':
        case 'connections_by_source':
        case 'traffic_by_source':
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'Source IP');
            break;
        case 'cyber_threat':
            drilldown('table_1_1', ['table_2_1'], 'Source IP');
            drilldown('table_1_2', ['table_2_2'], 'Destination IP');
            break;
        case 'devices_packets':
        case 'devices_traf':
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'Device', false, ['table_3_1', 'table_4_1']);
            drilldown('table_2_1', ['table_3_1'], 'Device/Interface', false, ['table_4_1']);
            drilldown('table_3_1', ['table_4_1'], 'Direction');
            break;
        case 'traffic_by_as':
            drilldown('chart_1_1', ['chart_2_1', 'table_2_1'], 'Autonomous System');
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'Autonomous System');
            break;
        case 'traffic_by_qos':
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'DeviceIn', 'Device');
            drilldown('table_1_2', ['chart_2_2', 'table_2_2'], 'DeviceOut', 'Device');
            break;
        case 'traffic_by_subnets':
            drilldown('table_1_1', ['table_2_1'], 'Subnet/mask');
            break;
        case 'palo_top_apps_users':
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'Application');
            break;
        case 'palo_top_connectors':
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'Source IP/User');
            break;
        case 'palo_top_destinations':
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'Destination IP');
            break;
        case 'palo_top_violators':
            drilldown('table_1_1', ['chart_2_1', 'table_2_1'], 'Source IP/User');
            break;
        case 'interfaces_traffic':
        case 'watched_interfaces':
            drilldown('table_1_1', ['table_2_1'], 'Device/Interface', false, ['table_3_1']);
            drilldown('table_2_1', ['table_3_1'], 'Direction');
            break;
        case 'interface_groups':
            drilldown('table_1_1', ['table_2_1'], 'Interface Group', false, ['table_3_1', 'table_4_1']);
            drilldown('table_2_1', ['table_3_1'], 'Device/Interface', false, ['table_4_1']);
            drilldown('table_3_1', ['table_4_1'], 'Direction');
            break;
    }
});

