#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import sys
import os
import splunk.Intersplunk as si
import logging, logging.handlers

from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
sys.path.append(make_splunkhome_path(['etc', 'apps', 'SA-Hydra', 'bin']))
sys.path.append(make_splunkhome_path(['etc', 'apps', 'Splunk_TA_vmware', 'bin']))
from hydra.models import SplunkStoredCredential
from ta_vmware.models import TAVMwareCollectionStanza
from vim25.connection import Connection

import syslog_configurator as sc


(isgetinfo, sys.argv) = si.isGetInfo(sys.argv)

if isgetinfo:
	#outputInfo(streaming, generating, retevs, reqsop, preop, timeorder=False):
	si.outputInfo(False, True, False, False, None, False)
	sys.exit(0)

results,dummyresults,settings = si.getOrganizedResults()
# results,dummyresults,settings = ([], [], {})

def setup_logger():
	"""
	Setup a logger for the search command
	"""
   
	logger = logging.getLogger('vmware_syslog_configurator')
	logger.setLevel(logging.DEBUG)
	file_handler = logging.handlers.RotatingFileHandler(os.environ['SPLUNK_HOME'] + '/var/log/splunk/vmware_syslog_configurator.log' )
	formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
	file_handler.setFormatter(formatter)
   	logger.addHandler(file_handler)
   	return logger
	
def test_get_data():
	creds = {'vcenter': 'apps-vcenter500.sv.splunk.com', 'username': 'Administrator', 'password': 'Splunk3r'}
	si = sc.create_connection(creds['vcenter'], creds['username'], creds['password'])
	if si is None: sys.exit("Could not create a valid connection")
	args = {'print': True}
	target_hosts = None
	vc_host_list = si.get_host_list()
	hosts = sc.get_hosts(vc_host_list, target_hosts)
	return sc.run_hosts_operation(si, hosts, args)


if __name__ == '__main__':
	try:
		logger = setup_logger()
		sessionKey = settings.get('sessionKey', None)
		owner = settings.get('owner', None)
		namespace = settings.get('namespace', None)
		logger.debug('settings are %s', str(settings))
		logger.debug('SessionKey=%s, owner=%s, namespace=%s', sessionKey, owner, namespace)
		logger.debug("sys.argv is %s", str(sys.argv))
		if sessionKey is None:
			logger.error("Did not get a session key")
			# sys.exit(1)
		foo = test_get_data()
		loghost_dict = dict([x['host_name'], x['syslog_info']['Syslog.global.logHost']] for x in foo)
		loghost_list = list([x['host_name'], x['syslog_info']['Syslog.global.logHost']] for x in foo)
		import time
		time.sleep(20)
		for k in loghost_list:
			si.outputResults([dict(zip(('box', 'loghost'), k))])
			logger.debug("wrote output")
			time.sleep(5)
		# si.outputResults([loghost_dict])
	except Exception as e:
		import traceback
		stack =  traceback.format_exc()
		err_results = si.generateErrorResults("Error '%s'" % stack)
		si.outputResults(err_results)
