import datetime
import json
import logging
import os
import os.path
import sys
import time
import traceback
import urllib
import urllib2

#CORE SPLUNK IMPORTS
import splunk
import splunk.search as splunkSearch
from splunk.rest import simpleRequest
import splunk.version as ver

# Modify Path to include SA-Utils/bin
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
sys.path.append(make_splunkhome_path(['etc', 'apps', 'SA-Utils', 'lib']))
from SolnCommon.messaging import Messenger
from SolnCommon.modinput import ModularInput, Field

########################################################################
# UTILITIES 
########################################################################
def setupLogger(logger=None, log_format='%(asctime)s %(levelname)s [LicenseAlert] %(message)s', level=logging.DEBUG, log_name="licensealert.log", logger_name="licensealert"):
    """
    Setup a logger suitable for splunkd consumption
    """
    if logger is None:
        logger = logging.getLogger(logger_name)
    
    logger.propagate = False # Prevent the log messages from being duplicated in the python.log file
    logger.setLevel(level)
    
    file_handler = logging.handlers.RotatingFileHandler(make_splunkhome_path(['var', 'log', 'splunk', log_name]), maxBytes=2500000, backupCount=5)
    formatter = logging.Formatter(log_format)
    file_handler.setFormatter(formatter)
    
    logger.handlers = []
    logger.addHandler(file_handler)
    
    logger.debug("Init Licensing logger")
    
    return logger


# NOTE: Splunk's bundled Python 2.7 omits the logging.handlers.NullHandler class.
#       So reimplementing it here.
class _NullHandler(logging.Handler):
    lock = None
    
    def emit(self, record):
        pass
    
    def handle(self, record):
        pass
    
    def createLock(self):
        return None


# Special expiration time infinity far in the future
_INFINITE_EXPIRATION_TIME = -1
# Special expiration time that means "unknown (but not expired) due to license on remote license master"
_UNKNOWN_NONEXPIRED_EXPIRATION_TIME = -2


# Implementations should override the values of all applicable fields.
class LicenseAlert(ModularInput):
    title = 'Splunk App for XXX - License Usage Monitor'
    description = \
        'Monitors Splunk App for XXX license usage. ' \
        'Disabling this input prevents access to the Splunk App for XXX.'
    
    # Application name
    # 
    # Used as (1) the <add_on name="..."> in license files for this app.
    #  and as (2) the section identifier in the licensealert.log file.
    name = None
    
    # Search string that determines the data usage of the app, in bytes.
    search = None
    searchResultUnit = 'BYTES' # overriding this is deprecated
    
    # Namespace under which searches will be run and messages will be created
    namespace = None
    owner = 'nobody'
    
    # Labels used to classify licenses by type
    trialLabel = None
    termLabel = None
    perpetualLabel = None
    downloadTrialLabel = None # optional
    
    # Unit that the license size is expressed in.
    # Supports values: 'BYTES', 'KB', 'MB', 'GB', 'TB'
    # 
    # Corresponds to (1) the unit of <parameter key="size" value="..."/> in the license file,
    #            and (2) the unit used to display the license size in the UI.
    licenseUnit = None
    # License size which is treated as an unlimited size if encountered in a license file.
    unlimitedSize = None
    # License expiration time typically used for perpetual licenses. Typically far in future.
    perpetualExpirationTime = None
    
    # (Optional) File where the latest license status will be written to.
    licenseStatusFilePath = None
    
    # Override the following to support automatic deployment of a demo license,
    # which is a Download Trial License that is bundled with the app.
    # 
    # (Optional) Path to a bundled demo license
    demoLicenseFilePath = None
    # (Optional) File where the latest demo license deployment status will be written to.
    demoLicenseStatusFilePath = None

    ########################################################################
    # MESSAGES (These message needs to over write as per each application)
    # Ideal way to overwrite in inherit class that copy paste these messages
    # and replace XXX with App name 
    ########################################################################
    NO_LIC_MSG = 'You have no license for Splunk App for XXX. Contact sales for a license.'
    EXPIRED_TRIAL_LIC_MSG = 'XXX App license has expired. Please contact Sales.'
    # Note: Below message expect one formated value which replace this with no of days left in the license, so make sure this is present in this message
    EXPIRED_LIC_MSG_IN_DAYS = 'You have {0} days remaining for your license of the Splunk App for XXX. Contact sales to get a license upgrade.'
    EXPIRED_LIC_MSG = 'Your license to use the Splunk App for XXX is expired. Contact sales to get a license upgrade.'
    EXCEED_BANDWIDTH_MSG = 'You have exceeded your daily licensing volume for Splunk App for XXX data.'

    def __init__(self):
        args = [
                Field("log_level", "Logging Level", "This is the level at which the scheduler will log data.", required_on_create=False)
                ]
        scheme_args = {'title': self.title,
                       'description': self.description,
                       'use_external_validation': "true",
                       'streaming_mode': "xml",
                       'use_single_instance': "false"}
        ModularInput.__init__(self, scheme_args, args)
        
        # Setup default null logger
        self.log = logging.getLogger('devnull')
        self.log.propagate = False
        self.log.addHandler(_NullHandler())

    def run(self, stanza):
        # Handle local authentication
        self.local_session_key = self._input_config.session_key
        self.local_server_uri = self._input_config.server_uri
        splunk.setDefault('sessionKey', self.local_session_key)
        
        # Setup modular input logger
        if isinstance(stanza, list):
            logLevel = stanza[0].get('log_level', "WARN").upper()
        else:
            logLevel = stanza.get('log_level', "WARN").upper()
        if logLevel not in ["DEBUG", "INFO", "WARN","WARNING", "ERROR"]:
            logLevel = logging.WARN
            self.log = setupLogger(logger=None, log_format='%(asctime)s %(levelname)s [' + self.name + '] %(message)s', level=logLevel, log_name="licensealert.log", logger_name="licensealert")
            self.log.warn("logLevel was set to a non-recognizable level it has be reset to WARNING level")
        else:
            self.log = setupLogger(logger=None, log_format='%(asctime)s %(levelname)s [' + self.name + '] %(message)s', level=logLevel, log_name="licensealert.log", logger_name="licensealert")
            self.log.debug("logger reset with log level of %s", str(logLevel))

        self._checkSubclassConfiguration()
        
        try:
            self.runLicenseCheck()
        except:
            self.log.error("Unexpected error while checking license: %s", repr(traceback.format_exc()))
    
    def _checkSubclassConfiguration(self):
        ALL_FIELDS = [f for f in dir(self) if not f.startswith('_')]
        OPTIONAL_FIELDS = [
            # Demo license fields
            'downloadTrialLabel',
            'licenseStatusFilePath',
            'demoLicenseFilePath',
            'demoLicenseStatusFilePath'
        ]
        
        REQUIRED_FIELDS = set(ALL_FIELDS) - set(OPTIONAL_FIELDS)
        for f in REQUIRED_FIELDS:
            if getattr(self, f) is None:
                error = 'LicenseAlert implementation did not specify a value for required field: %s' % f
                self.log.error(error)
                raise ValueError(error)
        
        UNIT_FIELDS = ['searchResultUnit', 'licenseUnit']
        for f in UNIT_FIELDS:
            if getattr(self, f).upper() not in ['BYTES', 'KB', 'MB','GB', 'TB']:
                error = 'LicenseAlert implementation did not specify valid value for unit field: %s' % f
                self.log.error(error)
                raise ValueError(error)
    
    def runLicenseCheck(self):
        # Perform search
        dataIndexed = self.getSearchResults()
        if dataIndexed is None:
            self.log.info('No data is indexed for app=%s or it is not configured', self.name)
        else:
            self.log.info('Indexed data for app is %s', dataIndexed)
        dataIndexed = self.convertToDataFormat(
            dataIndexed, self.searchResultUnit, self.licenseUnit)
        
        # Deploy demo license automatically if not already done
        deployError = self._tryDeployDemoLicenseIfNeeded()
        
        # Validate the installed licenses
        licenseStatus = self.verifyLicense(self.getLicenseInfo(), dataIndexed)
        
        # Mention problems deploying the demo license
        # if we don't already have another valid license.
        if deployError is not None and not licenseStatus['valid']:
            licenseStatus['messages'].insert(0, {
                'severity': 'warning',
                'description': 'Could not automatically apply demo license: %s' % 
                    deployError['message'],
                'type': ('bad_credentials_when_deploying_demo_license'
                    if deployError['type'] == 'bad_credentials'
                    else 'unknown')
            })
        
        # Report license validation messages in the UI
        for message in licenseStatus['messages']:
            Messenger.createMessage(
                message['description'],
                self.local_session_key,
                namespace=self.namespace, owner=self.owner)
        
        # Save license validation messages to file, for use by license status pages
        if self.licenseStatusFilePath is not None:
            with open(self.licenseStatusFilePath, 'wb') as licenseStatusFile:
                licenseStatusFile.write(json.dumps(licenseStatus))
    
    def verifyLicense(self, licenses, dataIndexed):
        '''
            Determines whether the current usage of this app meets the
            restrictions of the specified app licenses.
            
            @param licenseInfo: List of tuple which hold label, expiration time (unix epoch time) and license size
            @param dataIndexed: indexed data size
            
            @return: A LicenseStatus object.
                     See final return statement in implementation for the format.
        '''
        # NOTE: Normalize input for backward compatibility with old callers
        if not licenses:
            licenses = []
        if not dataIndexed:
            dataIndexed = 0
        
        messages = []
        
        licensesFound = False
        allLicensesExpired = True
        hasExpiredTrialLicense = False
        
        licenseStackSize = 0
        licenseStackSizeIsUnlimited = False
        licenseStackNextExpires = _INFINITE_EXPIRATION_TIME
        
        validLabels = [self.trialLabel, self.termLabel, self.perpetualLabel]
        if self.downloadTrialLabel is not None:
            validLabels.append(self.downloadTrialLabel)
        
        now = time.time()
        for (licenseLabel, licenseExpires, licenseSize) in licenses:
            # Ignore licenses that don't match a recognized label
            if licenseLabel not in validLabels:
                continue
            licensesFound = True
            self.log.info('Found app license: %s', licenseLabel)
            
            if licenseExpires == _UNKNOWN_NONEXPIRED_EXPIRATION_TIME:
                allLicensesExpired = False
            else:
                timediff = int(licenseExpires) - int(now)
                
                # Check whether license has expired already
                if timediff <= 0:
                    if self._isTrialLicense(licenseLabel):
                        hasExpiredTrialLicense = True
                    self.log.info('License "%s" expired at %s.', licenseLabel, licenseExpires)
                    continue
                allLicensesExpired = False
                
                # Warn if license will expire soon
                days = self._checkDaysInLicense(timediff)
                if days is None:
                    self.log.debug('License "%s" does not expire soon, so no action is taken.', licenseLabel)
                else:
                    messages.append({
                        'severity': 'warning',
                        'description': self.EXPIRED_LIC_MSG_IN_DAYS.format(days)
                    })
            
            # Sum up size of license stack
            if licenseSize >= self.unlimitedSize:
                licenseStackSizeIsUnlimited = True
            else:
                licenseStackSize += licenseSize
            
            # Compute earliest expiring license in stack
            licenseStackNextExpires = self._minExpirationTime(
                licenseStackNextExpires, licenseExpires, now)
        if not licensesFound:
            self.log.info('No app license found')
            messages.append({
                'severity': 'error',
                'description': self.NO_LIC_MSG
            })
        else:
            if allLicensesExpired:
                self.log.info('All licenses are expired.')
                messages.append({
                    'severity': 'error',
                    'description': \
                        # NOTE: Using two separate messages for backward
                        #       compatibility with subclasses
                        self.EXPIRED_TRIAL_LIC_MSG if hasExpiredTrialLicense else \
                        self.EXPIRED_LIC_MSG
                })
            
            if not licenseStackSizeIsUnlimited and dataIndexed > licenseStackSize:
                self.log.info('Exceeded the indexed volume')
                messages.append({
                    'severity': 'error',
                    'description': self.EXCEED_BANDWIDTH_MSG
                })
        
        if not licensesFound or allLicensesExpired:
            licenseStackNextExpires = 0 # arbitrary time in the past
        
        # Determine license stack validity based on presence of errors
        valid = True
        for m in messages:
            if m['severity'] == 'error':
                valid = False
        
        # Return a LicenseStatus object.
        # NOTE: This format is API. Beware of making breaking changes.
        return {
            'updated': now,
            'valid': valid,
            'messages': messages,
            'usage': {
                'current': dataIndexed,
                'max': licenseStackSize if not licenseStackSizeIsUnlimited else -1,
                'unit': self.licenseUnit
            },
            'expires': licenseStackNextExpires # NOTE: There are special expiration times < 0
        }
    
    def _isTrialLicense(self, label):
        if label == self.trialLabel:
            return True
        if self.downloadTrialLabel is not None and label == self.downloadTrialLabel:
            return True
        return False
    
    def _minExpirationTime(self, exp1, exp2, now):
        # Infinity
        if exp1 == _INFINITE_EXPIRATION_TIME:
            return exp2
        if exp2 == _INFINITE_EXPIRATION_TIME:
            return exp1
        
        # Unknown but non-expired
        if exp1 == _UNKNOWN_NONEXPIRED_EXPIRATION_TIME:
            if exp2 <= now: # exp2 is expired
                return exp2
            else:
                return _UNKNOWN_NONEXPIRED_EXPIRATION_TIME
        if exp2 == _UNKNOWN_NONEXPIRED_EXPIRATION_TIME:
            if exp1 <= now: # exp1 is expired
                return exp1
            else:
                return _UNKNOWN_NONEXPIRED_EXPIRATION_TIME
        
        # Normal
        assert exp1 >= 0 and exp2 >= 0
        if exp1 < exp2:
            return exp1
        else:
            return exp2

    def _checkDaysInLicense(self, timediff, daysThreshold=7):
        '''
            @param  timediff: time in seconds
            @param  daysThreshold: threshold days after that message is shown
            @return None if days is gather than threshold time else days left out
        '''
        days = datetime.timedelta(seconds = timediff).days + 1
        self.log.info('License is valid. %s day(s) left in license.', days)
        # Week or less
        if days > daysThreshold:
            return None
        else:
            return days

    def convertToDataFormat(self, value, sourceFormatType, dstFormatType):
        '''
            Accepting value in bytes and convert into BYTES KB, MB, GB and TB format
        '''
        if value is None:
            return value
        if sourceFormatType.upper() == dstFormatType.upper():
            return value
        else:
            # Why does python does not support enum, I would have done with better way if python support enum before 3.5
            if sourceFormatType.upper() == 'BYTES' and dstFormatType.upper() in ['KB', 'MB', 'GB', 'TB']:
                sourceFormatType = 'KB'
                return self.convertToDataFormat(value/1024.0, sourceFormatType, dstFormatType)
            if sourceFormatType.upper() == 'KB' and dstFormatType.upper() in ['MB', 'GB', 'TB']:
                sourceFormatType = 'MB'
                return self.convertToDataFormat(value/1024.0, sourceFormatType, dstFormatType)
            if sourceFormatType.upper() == 'MB' and dstFormatType.upper() in [ 'GB', 'TB']:
                sourceFormatType = 'GB'
                return self.convertToDataFormat(value/1024.0, sourceFormatType, dstFormatType)
            if sourceFormatType.upper() == 'GB' and dstFormatType.upper() in ['TB']:
                sourceFormatType = 'TB'
                return self.convertToDataFormat(value/1024.0, sourceFormatType, dstFormatType)

            # Higher to lower conversion
            if sourceFormatType.upper() == 'TB' and dstFormatType.upper() in ['GB', 'MB', 'KB', 'BYTES']:
                sourceFormatType = 'GB'
                return self.convertToDataFormat(value*1024, sourceFormatType, dstFormatType)
            if sourceFormatType.upper() == 'GB' and dstFormatType.upper() in ['MB', 'KB', 'BYTES']:
                sourceFormatType = 'MB'
                return self.convertToDataFormat(value*1024, sourceFormatType, dstFormatType)
            if sourceFormatType.upper() == 'MB' and dstFormatType.upper() in ['KB', 'BYTES']:
                sourceFormatType = 'KB'
                return self.convertToDataFormat(value*1024, sourceFormatType, dstFormatType)
            if sourceFormatType.upper() == 'KB' and dstFormatType.upper() in ['BYTES']:
                sourceFormatType = 'BYTES'
                return self.convertToDataFormat(value*1024, sourceFormatType, dstFormatType)

    def getLicenseInfo(self):
        '''
            Fetches information about installed licenses related to this app.
            
            @return a list of tuple (label : str, expirationTime : int|<special>, size : int)
        '''
        if self._getLicenseMasterInfo()['type'] == 'local':
            return self._getLicenseInfo(endpoint_type='licenses')
        else:
            return self._getLicenseInfo(endpoint_type='localslave')
    
    # Fetches information about app licenses using one of two possible endpoint types.
    # 
    # Endpoint type 'licenses':
    #     Supports local license master only.
    #     Available in Splunk 6.0+.
    # Endpoint type 'localslave':
    #     Supports local and remote license master.
    #     Only returns accurate license size info for Splunk 6.2+.
    #     Available in Splunk 6.0+.
    def _getLicenseInfo(self, endpoint_type):
        if endpoint_type not in ('licenses', 'localslave'):
            raise ValueError('Invalid endpoint_type: %s' % endpoint_type)
        
        if endpoint_type == 'licenses':
            uri = self.local_server_uri + '/services/licenser/licenses'
        elif endpoint_type == 'localslave':
            uri = self.local_server_uri + '/services/licenser/localslave'
        response, contents = self._simpleRequest(path=uri, getargs={'output_mode': 'json'}, sessionKey=self.local_session_key, method='GET')
        self.log.debug('Licensing endpoint response headers: %s', response)
        self.log.debug('Licensing endpoint response content: %s', contents)
        if response.status != 200:
            self.log.error('Failed to get data from server info end point=%s', uri)
            raise splunk.SplunkdException('Failed to get data from server info end point={0}'.format(uri))
        
        # Locate addon licenses
        licenseInfo = []
        for entry in json.loads(contents).get('entry', None):
            content = entry.get('content', None)
            if content is None:
                continue
            addOns = content.get('add_ons', None)
            if addOns is None:
                continue
            for app, value in addOns.iteritems():
                self.log.debug('Found one addon: %s, values: %s', app, value)
                if app == self.name:
                    if endpoint_type == 'licenses':
                        expTime = content.get('expiration_time', self.perpetualExpirationTime)
                        label = content.get('label', self.termLabel)
                        size = int(value.get('size', 0))
                    elif endpoint_type == 'localslave':
                        # JIRA: Cannot determine expiration time of app licenses
                        #       using this endpoint. Report as unknown. (SPL-91339, TAG-8265)
                        expTime = _UNKNOWN_NONEXPIRED_EXPIRATION_TIME
                        label = self.termLabel
                        try:
                            # NOTE: Per-addon license size information is only
                            #       available as of Splunk 6.2. Earlier versions
                            #       return the fixed value 'app' instead of a dict.
                            size = int(value['parameters']['size'])
                        except:
                            if value == 'app':
                                self.log.warn(
                                    'Cannot determine license size from search head running '
                                    'Splunk < 6.2 that uses a remote licensing master. '
                                    'Treating as unlimited license.')
                            else:
                                self.log.warn(
                                    'Invalid license size: %s. '
                                    'Treating as unlimited license.', value)
                            size = self.unlimitedSize
                    licenseInfo.append((label, expTime, size))
        
        self.log.debug('License information: %s', licenseInfo)
        return licenseInfo
        

    # Ran the give search and get the results of data usage
    def getSearchResults(self):
        '''
            Run search and get indexed data value       
            @return: If search successful return first result otherwise none
        '''
        # Get results
        self.log.info("Running search ...")
        if not self.search.startswith('search'):
            search = 'search ' + self.search
        else:
            search = self.search
        results = splunkSearch.searchOne(search, hostPath=self.local_server_uri, sessionKey=self.local_session_key, namespace=self.namespace, owner=self.owner)
        self.log.debug("Search results:%s", results)
        if results is not None:
            totalIndexedData = 0.0
            for value in results.values():
                totalIndexedData = totalIndexedData + float(str(value))
            return totalIndexedData if totalIndexedData > 0 else None
        else:
            self.log.info("Failed to get any results for the search={0}".format(search))
            return None
    
    # === Deploy Demo License ===
    
    def _tryDeployDemoLicenseIfNeeded(self):
        '''
            Tries to deploy a demo license to the license master
            if one hasn't already deployed.
            
            Returns None if success, or an error object {
                'type': 'already_deployed'|'unreachable'|'bad_credentials'|'unknown',
                'message': <str>
            }.
        '''
        # Abort if this implementation does not support demo licenses
        if None in (self.demoLicenseFilePath, self.demoLicenseStatusFilePath):
            return None
        
        # Load deployment status
        if os.path.exists(self.demoLicenseStatusFilePath):
            with open(self.demoLicenseStatusFilePath, 'rb') as f:
                deployError = json.load(f)
        else:
            deployError = {
                'type': 'unknown',
                'message': 'Never attempted to deploy demo license.'
            }
        
        # If undeployed, deploy the demo license and delete it
        if deployError is not None:
            self.log.info('Deploying demo license.')
            
            # NOTE: If the license master is remote, this will always fail
            #       because no remote credentials are specified here.
            deployError = self.tryDeployDemoLicense()
        else:
            self.log.debug('Demo license already deployed.')
        
        # If deployed, delete the demo license from the filesystem
        # (even if it reappears when this app is upgraded).
        # 
        # NOTE: This is done deliberately to keep the demo license
        #       in the filesystem for as short a time as possible.
        #       Deters folks who would prefer not to pay for our app.
        if deployError is None:
            if os.path.exists(self.demoLicenseFilePath):
                os.remove(self.demoLicenseFilePath)
        
        return deployError
    
    def tryDeployDemoLicense(self, username=None, password=None):
        '''
            Tries to upload a demo license to the license master.
            
            Returns None if success, or an error object {
                'type': 'already_deployed'|'unreachable'|'bad_credentials'|'unknown',
                'message': <str>
            }.
        '''
        deployError = self._tryDeployDemoLicense_impl(username, password)
        if deployError:
            self.log.error('Unable to deploy demo license: %s', repr(deployError))
    
        # Save new deployment status
        with open(self.demoLicenseStatusFilePath, 'wb') as f:
            json.dump(deployError, f)
        
        return deployError
    
    def _tryDeployDemoLicense_impl(self, username, password):
        if not os.path.exists(self.demoLicenseFilePath):
            # Assume that the license file is gone because it was already deployed.
            return {
                'type': 'already_deployed',
                'message': 'Demo license was already deployed.'
            }
        
        licenseMasterInfo = self._getLicenseMasterInfo()
        licenseMasterUri = licenseMasterInfo['uri']
        
        if licenseMasterInfo['type'] == 'local':
            try:
                # Try deploy license to local license master
                # (or possibly a remote one, in which case we will fail)
                response, content = self._simpleRequest(
                    path=licenseMasterUri + '/services/licenser/licenses',
                    sessionKey=self.local_session_key,
                    postargs={'name': self.demoLicenseFilePath},
                    method='POST')
            except:
                self.log.error('Problem while connecting to local license master: %s', repr(traceback.format_exc()))
                return {
                    'type': 'unreachable',
                    'message': 'Could not connect to local license master.'
                }
        
        elif licenseMasterInfo['type'] == 'remote':
            # Require credentials to be provided if using a remote license master
            if None in (username, password):
                return {
                    'type': 'bad_credentials',
                    'message': 'Need credentials for remote license master.'
                }
            
            # Login to remote license master
            try:
                _, response = self._simpleRequest(
                    licenseMasterUri + '/services/auth/login',
                    postargs={'username': username, 'password': password},
                    method='POST')
            except splunk.RESTException as e:
                if e.statusCode == 401: # Unauthorized
                    if (username, password) == ('admin', 'changeme'):
                        return {
                            'type': 'bad_credentials',
                            'message': 'Cannot access the admin account of the remote license master using the default password.'
                        }
                    else:
                        return {
                            'type': 'bad_credentials',
                            'message': 'Invalid username or password for remote license master.'
                        }
                else:
                    return {
                        'type': 'unknown',
                        'message': 'Could not authenticate to remote license master. Received HTTP %s: %s' % (e.statusCode, e.message)
                    }
            except:
                self.log.error('Problem while connecting to remote license master: %s', repr(traceback.format_exc()))
                return {
                    'type': 'unreachable',
                    'message': 'Could not connect to remote license master.'
                }
            
            # Extract session key for remote license master
            try:
                start_pos = response.index('<sessionKey>') + len('<sessionKey>')
                lim_pos = response.index('</sessionKey>', start_pos)
                session_key = response[start_pos:lim_pos]
            except:
                return {
                    'type': 'unknown',
                    'message': 'Received invalid response when authenticating to remote license master.'
                }
            
            with open(self.demoLicenseFilePath, 'rb') as f:
                licenseContent = f.read()
            
            # Try deploy license to remote license master
            try:
                response, content = self._simpleRequest(
                    path=licenseMasterUri + '/services/licenser/licenses',
                    sessionKey=session_key,
                    postargs={'name': 'Ignore', 'payload': licenseContent},
                    method='POST')
            except splunk.RESTException as e:
                return {
                    'type': 'unknown',
                    'message': 'Could not upload license to remote license master. Received HTTP %s: %s' % (e.statusCode, e.get_message_text())
                }
        
        # Don't leave the demo license in the filesystem
        os.remove(self.demoLicenseFilePath)
        
        # Success
        return None
    
    # === Utility ===
    
    def _getLicenseMasterInfo(self):
        response, content = simpleRequest(
            path=self.local_server_uri + '/services/properties/server/license/master_uri',
            getargs={'output_mode': 'json'},
            sessionKey=self.local_session_key,
            method='GET')
        
        if response.status == 200:
            return {
                'type': 'local' if content == 'self' else 'remote',
                'uri': self.local_server_uri if content == 'self' else content
            }
        else:
            raise splunk.SplunkdException(
                'Could not get license master URI. uri={0}'.format(uri))
    
    # === Test Hooks ===
    
    def _simpleRequest(self, *args, **kwargs):
        return simpleRequest(*args, **kwargs)
