require(['jquery', 'splunkjs/mvc/searchmanager', 'splunkjs/mvc/simplexml/ready!'], function($, SearchManager) {
 
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
        $('.dashboard-row1').removeClass('dashboard-row');
        $('#updateexp').submit(update_exporters);
        update_exporters_search.on('search:start', function() {
           $('#updateexp_text').html('&nbsp;&nbsp;Updating device list...');
        });
        update_exporters_search.on('search:failed', function() {
           $('#updateexp_text').html('&nbsp;&nbsp;Failed to update device list');
        });
        update_exporters_search.on('search:done', function() {
           $('#updateexp_text').html('&nbsp;&nbsp;Device list successfuly updated');
           window.location.reload(true);
        });
    });
});