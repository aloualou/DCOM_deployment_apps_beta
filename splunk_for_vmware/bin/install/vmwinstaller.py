import logging
from logging import handlers
import splunk
import os
import splunk.entity as en
import traceback

from deploy_default_lookup_files import deployDefaultLookupFiles

from . import getSplunkAppDir

def setup_logger():
	"""
	Setup a logger.
	"""
	logger = logging.getLogger('vmw-install')
	logger.propagate = False # Prevent the log messages from being duplicated in the python.log file
	logger.setLevel(logging.DEBUG)
	
	file_handler = handlers.RotatingFileHandler(os.environ['SPLUNK_HOME'] + '/var/log/splunk/vmw-install.log', maxBytes=25000000, backupCount=5)
	formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
	file_handler.setFormatter(formatter)
	
	logger.addHandler(file_handler)
	
	logger.debug("Init vmw-install logger")
	
	return logger

class VMWInstaller:
	"""
	Performs the various operations necessary to install VMW
	"""
	
	@staticmethod
	def doInstall( do_delete, sessionKey=None, splunk_home = None, logger = None, force = False ):
		
		# Compute the locations of the Splunk apps directory
		if splunk_home is None:
			splunk_app_dir = getSplunkAppDir()
			
		else:
			splunk_app_dir = os.path.join( splunk_home, "etc", "apps" )
		
		# Setup a logger if none was provided
		if logger is None:
			# Get the handler
			logger = setup_logger()
		
		# Log a message noting the VMW install is starting
		if logger:
			logger.info("Splunk for VMware install is starting, splunk_app_dir=%s" % (splunk_app_dir))
		
		# Run the various operations, note we limit all actions to just the splunk_for_vmware app 
		deployDefaultLookupFiles( os.path.join(splunk_app_dir,"splunk_for_vmware"), logger=logger )
		deployDefaultLookupFiles( os.path.join(splunk_app_dir,"SA-VMW-HierarchyInventory"), logger=logger )
		deployDefaultLookupFiles( os.path.join(splunk_app_dir,"SA-VMW-LogEventTask"), logger=logger )
		deployDefaultLookupFiles( os.path.join(splunk_app_dir,"SA-VMW-Performance"), logger=logger )
		
		# Disable/delete the old stuff
		da_list = ["DA-VMW-HierarchyInventory", "DA-VMW-LogEventTask", "DA-VMW-Performance", "SA-VMW-Licensecheck"]
		if do_delete:
			if logger: 
				logger.info("Splunk for VMware installer attempting to delete old domain add ons...")
			for da in da_list:
				uri = "/services/apps/local/" + da
				try:
					en.controlEntity('remove', uri, sessionKey)
					if logger:
						logger.info("Successfully deleted DA: %s" % da)
				except Exception, ex:
					if logger:
						logger.error("Some bad stuff happened trying to delete DA: %s please see traceback for more details" % (da))
						logger.error(traceback.format_exc())
						logger.debug(ex)

		else:
			if logger: 
				logger.info("Splunk for VMware installer attempting to disable but not delete old domain add ons...")
			for da in da_list:
				uri = "/services/apps/local/" + da + "/disable"
				try:
					en.controlEntity('disable', uri, sessionKey)
					if logger:
						logger.info("Successfully disabled DA: %s" % da)
				except Exception, ex:
					if logger:
						logger.error("Some bad stuff happened trying to disable DA: %s please see traceback for more details" % (da))
						logger.error(traceback.format_exc())
						logger.debug(ex)
					
		# Log a message noting the VMW install is done
		if logger:
			logger.info("Splunk for VMware install has completed")
	
	