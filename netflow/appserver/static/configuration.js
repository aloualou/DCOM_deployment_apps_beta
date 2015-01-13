require(['jquery', 'splunkjs/mvc/simplexml/ready!'], function($) {

var submit_enabled_sections = function(event) {
    $('#saving_text').html('Saving, please wait until the page is refreshed...');
    var pairs = {};
    $('#sections').find('input[type=checkbox]').each(function() {
        var k = this.id;
        var v = (this.checked ? '1' : '0');
        pairs[k] = v;
    });
    var setter_url = Splunk.util.make_url('custom', 'netflow', 'netflow_config_handler', 'set_multiple_keys');
    $.get(setter_url, 
          {
              'config': 'nfi_sections.conf', 
              'stanza': 'nfi', 
              'pairs': JSON.stringify(pairs)
          }, 
          false).always(
        function() {
            var builder_url = Splunk.util.make_url('custom', 'netflow', 'netflow_nav_handler', 'rebuild_nav');
            $.get(builder_url, false, false).always(
                function() {
                    $.get('/debug/refresh', false, false).always(
                        function() {
                            window.location.href = window.location.href;
                        });
                });
        });
    return;
};

var load_enabled_sections = function() {
    $('#sections').find('input[type=checkbox]').each(function() {
        var k = this.id;
        var getter_url = Splunk.util.make_url('custom', 'netflow', 'netflow_config_handler', 'get_key');
        var checkbox = this;
        $.get(getter_url, {'config': 'nfi_sections.conf', 'stanza': 'nfi', 'key': k}, function(val) {
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
};

$(document).ready(function() {
    $('#sections').submit(submit_enabled_sections);
    load_enabled_sections();
});

});

