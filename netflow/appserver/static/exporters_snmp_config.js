require(['jquery', 'splunkjs/mvc/searchmanager', 'splunkjs/mvc/simplexml/ready!'], function($, SearchManager) {

var submit_snmp_config = function(event) {
    $('#saving_text').html('Saving...');
    var pairs = {};
    $('#snmpconf').find('input[type=checkbox]').each(function() {
        var k = this.id;
        var v = (this.checked ? '1' : '0');
        pairs[k] = v;
    });
    $('#snmpconf').find('input:enabled[type=text]').each(function() {
        var k = this.id;
        var v = $(this).val();
        pairs[k] = v;
    });
    var setter_url = Splunk.util.make_url('custom', 'netflow', 'netflow_config_handler', 'set_multiple_keys');
    $.get(setter_url, 
          {
              'config': 'nfi_auto_snmp.conf', 
              'stanza': 'nfi', 
              'pairs': JSON.stringify(pairs)
          }, 
          false).always(
        function() {
            $.get('/debug/refresh', false, false).always(
                function() {
                    $('#saving_text').html('Saved');
                });
        });
    event.preventDefault();
    return;
};

var load_snmp_config = function() {
    var getter_url = Splunk.util.make_url('custom', 'netflow', 'netflow_config_handler', 'get_key');
    $('#snmpconf').find('input[type=checkbox]').each(function() {
        var k = this.id;
        var checkbox = this;
        $.get(getter_url, {'config': 'nfi_auto_snmp.conf', 'stanza': 'nfi', 'key': k}, function(val) {
            if (val == '1')
            {
                checkbox.checked = true;
            }
            else
            {
                checkbox.checked = false;
            }
        });
    });
    $('#snmpconf').find('input[type=text]').each(function() {
        var k = this.id;
        var textbox = this;
        $.get(getter_url, {'config': 'nfi_auto_snmp.conf', 'stanza': 'nfi', 'key': k}, function(v) {
            $(textbox).val(v);
        });
    });
};

var update_exporters_search = new SearchManager({
    id: 'save_exporters',
    autostart: false,
    cache: false,
    earliest_time: '-30m@m',
    latest_time: 'now',
    search: '| savedsearch "save_exporters" | collect index="flowintegrator_exp_ips"'
});

var update_exporters = function(event) {
    update_exporters_search.startSearch();
    event.preventDefault();
    return;
};

$(document).ready(function() {
    load_snmp_config();
    $('#snmpconf').submit(submit_snmp_config);
    $('#updateexp').submit(update_exporters);
    update_exporters_search.on('search:start', function() {
        $('#updateexp_text').html('Updating device list...');
    });
    update_exporters_search.on('search:failed', function() {
        $('#updateexp_text').html('Failed to update device list');
    });
    update_exporters_search.on('search:done', function() {
        $('#updateexp_text').html('Device list successfuly updated');
    });
});

});

