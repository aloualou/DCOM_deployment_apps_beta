#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import sys
import os
import re
import logging, logging.handlers
import splunk
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
sys.path.append(make_splunkhome_path(['etc', 'apps', 'SA-Hydra', 'bin']))
from hydra.models import SplunkStoredCredential

sys.path.append(make_splunkhome_path(['etc', 'apps', 'Splunk_TA_vmware', 'bin']))
import syslog_configurator

def setup_logger(name, filename, level=logging.INFO, formatstring='%(asctime)s %(levelname)s %(message)s'):
	"""
	Setup a logger for the search command
	"""
	logger = logging.getLogger(name)
	logger.setLevel(level)
	file_handler = logging.handlers.RotatingFileHandler(os.environ['SPLUNK_HOME'] + '/var/log/splunk/' + filename)
	formatter = logging.Formatter(formatstring)
	file_handler.setFormatter(formatter)
	logger.addHandler(file_handler)
	return logger

def process_args(argv):
	"""
	Takes sys.argv to the script and creates the args array that matches what 
	syslog_configurator methods expect to receive.  Assumes that the input is the raw
	sys.argv, with script name as the first value.
	"""
	args = dict(a.partition('=')[::2] for a in argv[1:])
	for a in args:
		if args[a].lower() in ['', 'false']:
			args[a] = None # match the behavior of argparse flag arguments
	return args

def filter_list(item_list, blacklist=None, whitelist=None, name_extractor=lambda x: x):
	"""
	Apply blacklists/whitelists to hostlist with custom name extractor
	If blacklist is not specified, blacklist search never matches
	If whitelist is not specified, whitelist search always matches
	Exclusion criterion: blacklist match OR NOT whitelist match

	(Old ListMatcher object logic was was follows:
	"accept_whitelist if whitelist is not specified OR ONE of WL regexes matches the element"
	"accept_blacklist if blacklist is not specified OR NONE of BL regexes matches the element"
	Inclusion criterion: "accept_whitelist AND accept_blacklist")
	"""
	included_items = []
	excluded_items = []
	if (blacklist is not None) and (blacklist != "None"):
		black_re_search = re.compile(blacklist, flags=re.S).search
	else:
		#fake re search method, always doesn't match
		black_re_search = lambda s: None
	if (whitelist is not None) and (whitelist != "None"):
		white_re_search = re.compile(whitelist, flags=re.S).search
	else:
		#fake re search method, always matches (sorta, really jsut always returns true instead ofnon None match object but whatevs)
		white_re_search = lambda s: True
	for item in item_list:
		#Peform PCRE matching, i.e. python re search
		if black_re_search(name_extractor(item)) or (white_re_search(name_extractor(item)) is None):
			excluded_items.append(item)
		else:
			included_items.append(item)
	return (included_items, excluded_items)
	
class SyslogConfigHelper(object):
	'''
	Helper class that facilitates communication to the vcenter based on the 
	credentials stored in Splunk
	'''
	def __init__(self, splunk_session_key, logger=None):
		self.host_path = splunk.mergeHostPath()
		self.session_key = splunk_session_key
		if logger is None:
			self.logger = setup_logger('vmware_syslog_configurator', 'vmware_syslog_configurator.log')
		else:
			self.logger = logger

	def get_connection(self, args):
		# FIXME: this is a thin wrapper over a method in syslog_configurator, 
		# we should either break connecting to vc into its own helper class
		# or integrate this helper class in with syslog_configurator
		try:
			password = self.get_vc_password(args['vcenter'], args['username'])
			return syslog_configurator.create_connection(args['vcenter'], args['username'], password)
		except KeyError as e:
			self.logger.error("Incorrect, missing, or malformed arguments (expected: vcenter, username)")
			self.logger.exception(e)
		except Exception as e:
			self.logger.error("Failed to create connection: " + str(e))
			self.logger.exception(e)

	def get_vc_password(self, target, username):
		"""
		Retrieves vc password from the storage/passwords endpoint
		"""
		return SplunkStoredCredential.get_password(target, username, "Splunk_TA_vmware", 
												   session_key=self.session_key, host_path=self.host_path)

