#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import sys
import splunk.Intersplunk as si
import logging

import splunk
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
sys.path.append(make_splunkhome_path(['etc', 'apps', 'SA-Hydra', 'bin']))
sys.path.append(make_splunkhome_path(['etc', 'apps', 'Splunk_TA_vmware', 'bin']))
sys.path.append(make_splunkhome_path(['etc', 'apps', 'splunk_for_vmware', 'appserver', 'controllers']))

from ta_vmware.models import TAVMwareCollectionStanza, TAVMwareSyslogForwarderStanza

import syslog_config_util
import re

def get_filtered_hostlists(connection, vc_stanza, cur_whitelist=None, cur_blacklist=None, prev_whitelist=None, prev_blacklist=None):
	names = lambda x: [y['name'] for y in x]
	
	if cur_blacklist is None and cur_whitelist is None:
		cur_blacklist, cur_whitelist = vc_stanza.managed_host_blacklist, vc_stanza.managed_host_whitelist

	if cur_blacklist == "None": cur_blacklist = None
	if cur_whitelist == "None": cur_whitelist = None
	
	if prev_blacklist is None and prev_whitelist is None: # assume no wl/bl changes
		prev_blacklist, prev_whitelist = cur_blacklist, cur_whitelist
	host_list = connection.get_host_list()
	# Connection returns a list of dicts containing host info in KV format (moid, name, etc.)
	try:
		prev_collection_list = syslog_config_util.filter_list(host_list, prev_blacklist, prev_whitelist, lambda x: x['name'])[0]
	except re.error:
		# well, we are in a pickle here: the prev_* regexes just failed to validate, so we
		# will assume a sensible and harmless default: set prev regex to whitelisting .*
		prev_collection_list = syslog_config_util.filter_list(host_list, None, r".*", lambda x: x['name'])[0]
	try:
		cur_collection_list = syslog_config_util.filter_list(host_list, cur_blacklist, cur_whitelist, lambda x: x['name'])[0]
		logger.debug("pcl: %s, ccl: %s", str(prev_collection_list), str(cur_collection_list))
	except re.error:
		raise Exception("check regular expression validity")
	newly_disabled_names = set(names(prev_collection_list)).difference(set(names(cur_collection_list)))
	logger.debug("Newly disabled hosts: %s", str(newly_disabled_names))
	newly_disabled_list = [x for x in prev_collection_list if x['name'] in newly_disabled_names]
	return cur_collection_list, newly_disabled_list
	
def get_vc_stanza(vc, local_session_key):
	local_host_path = splunk.mergeHostPath()
	vc_stanza = TAVMwareCollectionStanza.from_name(vc, app="Splunk_TA_vmware", host_path=local_host_path, session_key=local_session_key)
	if not vc_stanza or vc_stanza.target_type != "vc":
		raise Exception("Error getting vmware target stanza")
	elif vc_stanza.target[0] != vc:
		raise ValueError("stanza target %s does not match the specified vc name %d" % (vc_stanza.target[0], vc))
	return vc_stanza

def get_hostlist_from_vc(args, sessionKey):
	vc_stanza = get_vc_stanza(args['vcenter'], sessionKey)
	args['username'] = vc_stanza.username
	logger.debug("processed args: %s", str(args))
	connection_helper = syslog_config_util.SyslogConfigHelper(sessionKey, logger)
	connection = connection_helper.get_connection(args)
	# connection here is an object returned via simple vsphere utils via vSphereService(vc_fqdn, user, password)
	if connection is None: 
		logger.error("Connection does not exist")
		raise Exception("Connection does not exist")
	target_hosts_info, newly_disabled_hosts_info = get_filtered_hostlists(
		connection, vc_stanza, 
		cur_whitelist=args.get('cur_whitelist', None), cur_blacklist=args.get('cur_blacklist', None),
		prev_whitelist=args.get('prev_whitelist', None), prev_blacklist=args.get('prev_blacklist', None))
	for r in target_hosts_info:
		r.update({'vcenter': args['vcenter'], 'username': args['username'], 'new_state': 'on'})
	for r in newly_disabled_hosts_info:
		r.update({'vcenter': args['vcenter'], 'username': args['username'], 'new_state': 'off'})
	target_hosts_info.extend(newly_disabled_hosts_info)
	# target host info is a list of host info dicts
	connection.logout()
	return target_hosts_info

def get_all_vcs(sessionKey):	
	vcs = []
	stanzas = TAVMwareSyslogForwarderStanza.all(sessionKey=sessionKey)
	stanzas = stanzas.filter_by_app("Splunk_TA_vmware")
	stanzas._owner = "nobody"
	for s in stanzas:
		if s.status:
			vcs.append(s.name)
	return vcs

if __name__ == '__main__':
	try:
		logger = syslog_config_util.setup_logger('vmware_syslog_configurator', 
												 'vmware_syslog_configurator.log', logging.DEBUG, 
												 '[GEN_HOST] %(asctime)s %(levelname)s %(message)s')
		splunk.setDefault()
		results,dummyresults,settings = si.getOrganizedResults()
		sessionKey = settings.get('sessionKey', None)
		
		logger.debug('SessionKey=%s', sessionKey)
		logger.debug("sys.argv is %s", str(sys.argv))
		if sessionKey is None:
			logger.error("Did not get a session key")
			raise Exception("Did not get a session key")
		args = syslog_config_util.process_args(sys.argv)
		if 'vcenter' in args:
			if args['vcenter'].lower() in ['all', '*']:
				vc_list = get_all_vcs(sessionKey)
				logger.debug("requesting all VCs; got vc list %s", str(vc_list))
			else:
				vc_list = [args['vcenter']]
		target_hosts_info = []
		for vc in vc_list:
			args['vcenter'] = vc
			target_hosts_info.extend(get_hostlist_from_vc(args, sessionKey))
		si.outputResults(target_hosts_info)
	except Exception as e:
		logger.exception(e)
		si.outputResults(si.generateErrorResults("cannot get host list: %s" % e))

