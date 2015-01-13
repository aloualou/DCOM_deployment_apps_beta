#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import sys
import splunk.Intersplunk as si
import copy
import logging
import random

import splunk
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
sys.path.append(make_splunkhome_path(['etc', 'apps', 'SA-Hydra', 'bin']))
sys.path.append(make_splunkhome_path(['etc', 'apps', 'Splunk_TA_vmware', 'bin']))
from ta_vmware.models import TAVMwareSyslogForwarderStanza
import syslog_config_util
import syslog_configurator


	
def get_target_hosts_from_args(args):
	if args['target_hosts'] is not None:
		target_hosts = [x.strip(' ') for x in args['target_hosts'].split(',')]
		return target_hosts

		
def get_hosts_from_results(res, state='on'):
	if state not in ['on', 'off']:
		raise ValueError("State argument must be one of 'on', 'off'")
	return [(x['name'], x['moid'], x['config.product.version'], x['config.product.name']) for x in res if x.get('new_state', 'on') == state]

def update_args_from_results(args, results):
	try:
		if 'vcenter' not in args:
			args['vcenter'] = results[0]['vcenter']
		if 'username' not in args:
			args['username'] = results[0]['username']
	except Exception as e:
		logger.debug("Failed to update args dictionary")
		logger.exception(e)
		si.generateErrorResults("Syslogconfig command failure: could not update args from results")


def vcs_from_results(results):
	vclist = []
	for r in results:
		if 'vcenter' in r and 'username' in r:
			vclist.append((r['vcenter'], r['username']))
	return list(set(vclist))
		

def per_vc_operation(args, results, sessionKey, logger):
	retval = []
	if 'vcenter' in args: # assume results pertain to a single vc
		retval.extend(run_operation(args, results, sessionKey, logger))
	else:
		vclist = vcs_from_results(results)
		for vc, user in vclist:
			results_subset = [r for r in results if r['vcenter'] == vc]
			args['vcenter'], args['username'] = vc, user
			if "set_loghost" not in args and "repair" in args:
				logger.debug("setting 'set_loghost' and 'clear_existing' flags from stanza")
				sfs = TAVMwareSyslogForwarderStanza.from_name(vc, "Splunk_TA_vmware", session_key=sessionKey)
				if not sfs:
					raise Exception("could not establish set_loghost from conf nor from search command args, cannot configure hosts under vcenter=%s", vc)
				else:
					logger.debug("vc:{0}, sysloguri:{1}, status:{2}, validation_status:{3}".format(vc, sfs.uri, sfs.status, sfs.validation_status))
					# Convert array to string so we will consistent between initial assignment and repair operation
					args["set_loghost"] = ','.join(sfs.uri) if sfs.uri else ""
					args["clear_existing"] = False
			retval.extend(run_operation(args, results_subset, sessionKey, logger))
			# Delete del args["set_loghost"] to pick up new value for next vc
			if args.get("set_loghost", False):
				del args["set_loghost"]
	return retval
	
def run_operation(args, results, sessionKey, logger):
	connection_helper = syslog_config_util.SyslogConfigHelper(sessionKey, logger)	
	connection = connection_helper.get_connection(args)
	logger.debug("Created VC connection, executing operation")
	host_tuples = get_hosts_from_results(results, 'on')
	logger.debug("Got hosts: %s", str([x[0] for x in host_tuples]))
	retValues = syslog_configurator.execute_operation(connection, host_tuples, args)
	if retValues is None:
		logger.warn("syslog_configurator returned None")
		retValues = []
	host_tuples_off = get_hosts_from_results(results, 'off')
	if host_tuples_off:
		logger.debug("Got OFF hosts: %s", str([x[0] for x in host_tuples_off]))
		if "set_loghost" in args:
			args_ = args.copy()
			args_["set_loghost"] = ""
			#The args to execute operation MUST be in this order for the decorator to function
			retValues.extend(syslog_configurator.execute_operation(connection, host_tuples_off, args_) or [])
	for r in retValues:
		if 'syslog_info' in r:
			r['syslog_info'] = r['syslog_info']['Syslog.global.logHost'].split(',')
	logger.debug("return values from operation are %s", str(retValues))
	connection.logout()
	return retValues

if __name__ == '__main__':
	try:
		logger = syslog_config_util.setup_logger('vmware_syslog_configurator', 
			'vmware_syslog_configurator.log', logging.DEBUG, 
			'[SYSLOG_CONFIG] %(asctime)s %(levelname)s %(message)s')

		results, dummyresults, settings = si.getOrganizedResults()
		sessionKey = settings.get('sessionKey', None)
		logger.debug('SessionKey=%s', sessionKey)
		logger.debug("sys.argv is %s", str(sys.argv))
		if sessionKey is None:
			logger.error("Did not get a session key")
			raise ValueError("syslog configurator requires a valid splunk session key to function")
		logger.debug("read results: %s", str(results))
		args = syslog_config_util.process_args(sys.argv)
		logger.debug("processed args: %s", str(args))
		if "repair" in args:
			logger.debug("repair flag set, doing a per host configuration, i.e. a repair")
			# repair operations must not have vcenter arg specified
			# (yeah this logic is strange, we should refactor it eventually)
			if "vcenter" in args:
				del args["vcenter"]
		else:
			logger.debug("Doing a (non-repair) per vc configuration over all vc's indicated in args")
		retValues = per_vc_operation(args, results, sessionKey, logger)
		si.outputResults(retValues)

	except syslog_configurator.ScriptAlreadyRunningException as e:
		si.generateErrorResults("Syslog configuration task is already running")
		logger.debug("Caught script already running exception")
	except Exception as e:
		logger.exception(e)
		si.generateErrorResults("Syslogconfig command error: %s" % e)


