import sys

#Modify Path to include SA-Utils/bin
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
sys.path.append(make_splunkhome_path(['etc', 'apps', 'SA-Utils', 'bin']))

from licensealert import LicenseAlert

class VMwareLicenseCheck(LicenseAlert):
    title = 'Splunk App for VMware - License Usage Monitor'
    description = \
        'Monitors Splunk App for VMware license usage. ' \
        'Disabling this input prevents access to the Splunk App for VMware.'
    
    name = 'vmware'
    
    search = 'index=_internal source=*license_usage.log* type=Usage st=vmware:* earliest=-1d@d latest=@d | stats sum(b) as perSourceType by st | stats sum(perSourceType) as totalUsageBytes'
    searchResultUnit = 'Bytes'
    
    namespace = 'splunk_for_vmware'

    trialLabel = 'App-VMWare Trial'
    termLabel = 'App-VMWare Term'
    perpetualLabel = 'App-VMWare Perpetual'
    downloadTrialLabel = 'App-VMWare Download Trial'
    
    licenseUnit =  'GB'
    unlimitedSize = 101
    perpetualExpirationTime = 2145945600
    
    licenseStatusFilePath = make_splunkhome_path(
        ['etc', 'apps', 'splunk_for_vmware', 'bin', 'LicenseStatus.json'])
    
    demoLicenseFilePath = make_splunkhome_path(
        ['etc', 'apps', 'splunk_for_vmware', 'bin', 'vmware.downloadtrial.lic'])
    demoLicenseStatusFilePath = make_splunkhome_path(
        ['etc', 'apps', 'splunk_for_vmware', 'bin', 'DemoLicenseStatus.json'])
    
    ########################################################################
    # MESSAGES 
    ########################################################################
    NO_LIC_MSG = 'You have no license for Splunk App for VMware. Contact sales for a license.'
    EXPIRED_TRIAL_LIC_MSG = 'VMware App license has expired. Please contact Sales.'
    EXPIRED_LIC_MSG_IN_DAYS = 'You have {0} days remaining for your license of the Splunk App for VMware. Contact sales to get a license upgrade.'
    EXPIRED_LIC_MSG = 'Your license to use the Splunk App for VMware is expired. Contact sales to get a license upgrade.'
    EXCEED_BANDWIDTH_MSG = 'You have exceeded your daily licensing volume for Splunk App for VMware data.'

if __name__ == '__main__':
    licenseCheck = VMwareLicenseCheck()
    licenseCheck.execute()
    sys.exit(0)