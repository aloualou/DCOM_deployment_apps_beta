define([
    'jquery',
    'underscore',
    'backbone',
    // JIRA: Undocumented API usage required. (SPL-87449)
    //       
    //       Must wait for dashboard to load because <html> panels get rendered
    //       twice and we need to have the final panel loaded before attaching
    //       event listeners and similar to elements in the panel.
    'splunkjs/mvc/simplexml/ready!'
], function(
    $,
    _,
    Backbone
) {
    var LicenseStatusView = Backbone.View.extend({
        constructor: function() {
            var that = this;
            
            this.clear();
            
            var refreshBtn = $('#licensestatus-refresh-btn');
            refreshBtn.on('click', function() {
                if (refreshBtn.hasClass('disabled')) {
                    return;
                }
                that.trigger('refresh');
            });
            
            var applyLicenseMasterCredsBtn = $('#licensestatus-apply-demo-license');
            applyLicenseMasterCredsBtn.on('click', function() {
                if (applyLicenseMasterCredsBtn.hasClass('disabled')) {
                    return;
                }
                that.trigger(
                    'apply_demo_license',
                    $('#licensestatus-lmc-input-email').val(),
                    $('#licensestatus-lmc-input-password').val());
            });
        },
        
        clear: function() {
            this.setStatus({
                'updated': -1,
                'valid': false,
                'messages': [],
                'usage': {
                    'current': 0,
                    'max': -1,
                    'unit': 'GB'
                },
                'expires': -1
            });
            this._setMessagesInContainer($('#licensestatus-status'), [{
                'severity': 'warning',
                'description': 'Checking license status...'
            }]);
            this._setMessagesInContainer($('#licensestatus-messages'), [{
                'severity': 'warning',
                'description': 'Checking license status...'
            }]);
        },
        
        setStatus: function(licenseStatus) {
            // Display overall license status
            var statusMessage;
            if (!licenseStatus.valid) {
                statusMessage = {
                    'severity': 'error',
                    'description': 'No valid license detected. See details below.'
                };
            } else {
                if (licenseStatus.messages.length > 0) {
                    statusMessage = {
                        'severity': 'warning',
                        'description': 'License valid but there are warnings. See details below.'
                    };
                } else {
                    statusMessage = {
                        'severity': 'info',
                        'description': 'License valid.'
                    };
                }
            }
            this._setMessagesInContainer($('#licensestatus-status'), [statusMessage]);
            
            // Display last updated
            var refreshButtonEnabled;
            var lastUpdatedText;
            if (licenseStatus.updated === -1) {
                refreshButtonEnabled = false;
                lastUpdatedText = 'Refreshing...';
            } else {
                var updated = new Date(licenseStatus.updated * 1000);
                refreshButtonEnabled = true;
                lastUpdatedText =
                    'Last updated ' + updated.toDateString() + ' at ' + 
                    updated.toTimeString();
            }
            $('#licensestatus-refresh-btn')[refreshButtonEnabled ? 'removeClass' : 'addClass']('disabled');
            $('#licensestatus-last-updated').text(' ' + lastUpdatedText);
            
            // Display all license monitor messages
            var licenseMessages = licenseStatus.messages;
            if (licenseStatus.messages.length > 0) {
                licenseMessages = licenseStatus.messages;
            } else {
                licenseMessages = [{
                    'severity': 'info',
                    'description': 'No license monitor messages. Valid license detected.'
                }];
            }
            this._setMessagesInContainer($('#licensestatus-messages'), licenseMessages);
            
            // Display the days remaining
            var now = new Date().getTime() / 1000;
            var daysRemaining = Math.max(0,
                Math.ceil((licenseStatus.expires - now) / (24*60*60)));
            var daysRemainingText;
            var daysRemainingUnknownExplanation = false;
            if (licenseStatus.expires === -1 || daysRemaining > (365*5)) {
                daysRemainingText = '∞';
                daysRemaining = -1; // reclassify
            } else if (licenseStatus.expires === -2) {
                daysRemainingText = 'Unknown';
                daysRemaining = -1; // reclassify
                daysRemainingUnknownExplanation = true; // reclassify
            } else {
                daysRemainingText = '' + daysRemaining;
            }
            $('#licensestatus-days-remaining').text(daysRemainingText);
            if (daysRemainingUnknownExplanation) {
                $("#licensestatus-days-remaining-unknown-explanation").show();
            } else {
                $("#licensestatus-days-remaining-unknown-explanation").hide();
            }
            
            // Color the days remaining
            var daysRemainingStatus;
            if (daysRemaining <= 3 && daysRemaining != -1) {
                daysRemainingStatus = 'critical';
            } else if (daysRemaining <= 7 && daysRemaining != -1) {
                daysRemainingStatus = 'warning';
            } else {
                daysRemainingStatus = 'okay';
            }
            $('#licensestatus-days-remaining').attr('class', daysRemainingStatus);
            
            // Display the data usage bar
            var usageUsedText = '' + licenseStatus.usage.current.toFixed(2);
            var usageMaxText;
            var usageUnit = licenseStatus.usage.unit;
            var usageFrac = 0;
            if (licenseStatus.usage.max === -1) {
                usageFrac = 0;
                usageMaxText = '∞';
            } else {
                if (licenseStatus.usage.max === 0) {
                    usageFrac = 1;
                } else {
                    usageFrac = licenseStatus.usage.current / licenseStatus.usage.max;
                }
                usageMaxText = '' + licenseStatus.usage.max.toFixed(2);
            }
            var usagePercent = Math.round(usageFrac * 100);
            $('#licensestatus-usage-description').text(
                usageUsedText + ' ' + usageUnit +
                ' used out of ' + usageMaxText + ' ' + usageUnit +
                ' maximum (' + usagePercent + '%)');
            $('#licensestatus-usage-bar-inner').css('width', usagePercent + '%');
            
            // Color the data usage bar
            var usageStatus;
            if (usageFrac >= 0.90) {
                usageStatus = 'critical';
            } else if (usageFrac >= 0.70) {
                usageStatus = 'warning';
            } else {
                usageStatus = 'okay';
            }
            $('#licensestatus-usage-bar-inner').attr('class', usageStatus);
        },
        
        _setMessagesInContainer: function(messagesContainer, messages) {
            // Creates a message element of severity 'info', 'warning', or 'error'.
            var createMessageElement = function(severity, description) {
                var el = $('<li><div class="alert"><i class="icon-alert"></i> <span>MESSAGE</span> </div></li>');
                $('div', el).addClass('alert-' + severity);
                $('span', el).text(description);
                return el;
            };
            
            messagesContainer.empty();
            _.each(messages, function(message) {
                var messageEl = createMessageElement(
                    message.severity,
                    message.description);
                if (message.type == 'bad_credentials_when_deploying_demo_license') {
                    $('<button class="btn btn-primary" data-toggle="modal" ' +
                      ' data-target="#licensestatus-lmc-modal">' +
                      'Fix</button>').appendTo($('div', messageEl));
                }
                messageEl.appendTo(messagesContainer);
            });
        },
        
        setCredentialsModalAlert: function(description) {
            if (description) {
                $('#licensestatus-lmc-alerts .alert span').text(description);
                $('#licensestatus-lmc-alerts').show();
            } else {
                $('#licensestatus-lmc-alerts').hide();
            }
        },
        
        setCredentialsModalEnabled: function(enabled) {
            $('#licensestatus-lmc-modal form input').prop('disabled', !enabled);
            $('#licensestatus-apply-demo-license')[enabled ? 'removeClass' : 'addClass']('disabled');
        },
        
        dismissCredentialsModal: function() {
            $('#licensestatus-lmc-modal').modal('hide');
        },
        
        setWaitForLicenseMasterModalVisible: function(visible) {
            $('#licensestatus-wlm-modal').modal(visible ? 'show' : 'hide');
        },
        
        getWaitForLicenseMasterModalVisible: function() {
            return $('#licensestatus-wlm-modal').data('modal').isShown;
        }
    });
    
    return LicenseStatusView;
});