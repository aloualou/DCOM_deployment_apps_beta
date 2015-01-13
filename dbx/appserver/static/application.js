// determine Splunk version
var splVersion = 0,
    bodyClass = $('body').attr('class'),
    hasSplVersion = ( bodyClass.indexOf("splVersion-") >= 0 ) ? true : false,
    splVersionRex = /splVersion-([0-9]+)/,
    match =  splVersionRex.exec(bodyClass),
    // deferred promise ... deal with async loading in 6.0+
    pageLoading = $.Deferred(),
    poller; 

if(hasSplVersion && match !== null) {
    // if we can extract the splVersion class attribute from the body class
    // then we will assign it here. Otherwise version remains = 0
    splVersion = match[1];
}


// when our AccountBar is available , peform the replacement. 
$.when(pageLoading).then(function($obj) {
    var from = 'dbx',
        to  = 'DBX',
        selector = (splVersion > 5) ? '#global-help-menu li:contains("Documentation") a' : 'div.AppBar a.help',
        $target = ($obj)? $obj: $(selector),
        helpLink = $target.attr("href"),
        versionRex = /%3A(\d+)\.(\d+)(?:\.(\d+))?%5D/,
        matches = helpLink.match(versionRex),
        maj = matches[1],
        min = matches[2],
        rev = matches[3],
        maj_min_rev = [maj,min,rev].join("."),
        maj_min = [maj,min].join(".");

    helpLink = helpLink.replace(from,to);

    // if we have a 3-digit version x.0.0 then replace with x.0
    if( min === "0"  && min === rev) {
        helpLink = helpLink.replace(maj_min_rev,maj_min);
    }
   
    $target.attr("href",helpLink);
});

if(splVersion > 5) {
    poller = setInterval(function(){
        var $spl6Help = $('#global-help-menu li:contains("Documentation") a'),
            helpLink = $spl6Help.attr("href"),
            version = /%3A(\d+)\.(\d+)(?:\.(\d+))?%5D/;
        
        // we need to wait for the element to exist and also for the contents to 
        // contain the version number... ugly ... but no event hooks :(
        if($spl6Help.length > 0 && helpLink.match(version)) {
            pageLoading.resolve($spl6Help);
            clearInterval(poller);
        }
    },200);
} else {
    // resolve immediately on Splunk 5. No async-client rendering to deal with
    pageLoading.resolve()
}


if(Splunk.util.getCurrentView() == 'dbinfo') {
    $.extend(Splunk.Module.EntitySelectLister.prototype, {
        renderResults: function(html) {
            $('select', this.container).empty();
            $('select', this.container).append('<option value="" selected>Select a database</option>');
            $('select', this.container).append(html);
            this.selectSelected();
            $('select', this.container).removeAttr('disabled');
            Splunk.Module.AbstractEntityLister.prototype.renderResults.call(this, html);
        }
    });
    Splunk.Module.ConvertToIntention = $.klass(Splunk.Module.ConvertToIntention, {
        isReadyForContextPush: function($super) {
            var ctx = this.getContext();
            for (var i=0; i<this._matches.length; i++) {
                if(!ctx.get(this._matches[i])) return false;
            }
            return $super();
        }
    });
    Splunk.Module.SimpleResultsTable = $.klass(Splunk.Module.SimpleResultsTable, {
        renderResults: function($super,data) {
            $super(data);
            $('td[field=ref]', this.container).hide();
            $('span.sortLabel:contains("ref")', this.container).parents('th').hide();
        }
    });
    Splunk.Module.TextSetting = $.klass(Splunk.Module.TextSetting, {
        _bindEventOnFormElement: function($super){ $super('keydown'); this._formElement.val("*"); },
        onEvent: function(e) {
            if(e.keyCode == 13) {
                this.pushContextToChildren();
            }
        }
    });
    Splunk.Module.SearchSelectLister = $.klass(Splunk.Module.SearchSelectLister,{
        getResults: function($super) {
            $(this.container).find('select>option').text('Loading...');
            $super();
        },
        selectSelected: function(){
            $('select > option:contains("(default)")', this.container).prop('selected', true);
        }
    });
}
if(Splunk.util.getCurrentView() == 'dbquery') {
    Splunk.Module.JobStatus = $.klass(Splunk.Module.JobStatus, {
        getHeaderFragment: function(name, job) {
            var returnDict = {"name": name};
            switch (name) {
                case "events":
                    var events = job.getResultCount();
                    if (job.isDone()) {
                        returnDict["text"] = sprintf(ungettext('%s rows returned', '%s rows returned', events), format_number(events));
                    } else {
                        returnDict["text"] = sprintf(/* TRANS: &#8805 is the greater than or equal to symbol */ungettext('&#8805; %s matching rows', '&#8805; %s matching rows', events), format_number(events));
                    }
                    break;
                case "scanned":
                    var scanned = job.getScanCount();
                    returnDict["text"] = sprintf(ungettext('%s scanned rows', '%s scanned rows', scanned), format_number(scanned));
                    break;
                case "progress":
                    var progress = Math.round(job.getDoneProgress() * 100);
                    returnDict["text"] = sprintf(_('%s%% complete'), progress);
                    break;
                case "results":
                    var results = job.getResultCount();
                    returnDict["text"] = sprintf(ungettext('%s result', '%s results', results), format_number(results));
                    break;
                default:
                    this.logger.error("getHeaderFragment - unknown name provided - ", name);
                    returnDict["text"] = "";
                    break;
            }
            return returnDict;
        }
    });
}
/**
 * Customize the message module so it wont constantly be telling the user 
 * things that they dont care about and things that might alarm them.
 * DBX-200, DBX-213
 */
if (Splunk.Module.Message) {
    Splunk.Module.Message= $.klass(Splunk.Module.Message, {
        getHTMLTransform: function($super){
            var argh = [
                {contains:"No CSV input", level:"error"},
                {contains:"Parameter #1 has not been set", level:"error"},
                {contains:"No value specified for parameter 1", level:"error"}
            ],
            messages, message;

            // backwards compatibility due to Message module change
            if (this.displayedMessages != undefined) {
                messages = this.displayedMessages;
            } else messages = this.messages;

            for (var i=0; i<messages.length;){
                message = messages[i];
                for (var j=0; j<argh.length; j++) {
                    if (message != undefined
                    && (message.content.indexOf(argh[j]["contains"])!=-1)
                    && (message.level == argh[j]["level"])) {
                        messages.splice(i, 1);
                        // decrement the counter to account for the splice
                        i--;
                        break;
                    }
                }
                i++;
            }

            if (this.displayedMessages != undefined) {
                this.displayedMessages = messages;
            } else this.messages = messages;

            return $super();
        }
    });
}
