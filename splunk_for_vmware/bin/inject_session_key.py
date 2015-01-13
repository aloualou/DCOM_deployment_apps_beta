import sys
import os
import splunk.Intersplunk as si
import logging, logging.handlers

(isgetinfo, sys.argv) = si.isGetInfo(sys.argv)

if isgetinfo:
	#outputInfo(streaming, generating, retevs, reqsop, preop, timeorder=False):
	si.outputInfo(False, False, True, False, None, False)
	sys.exit(0)

results,dummyresults,settings = si.getOrganizedResults()

def setup_logger():
	"""
	Setup a logger for the search command
	"""
   
	logger = logging.getLogger('session_key_injector')
	logger.setLevel(logging.INFO)
	file_handler = logging.handlers.RotatingFileHandler(os.environ['SPLUNK_HOME'] + '/var/log/splunk/sessionkey_injector.log' )
	formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
	file_handler.setFormatter(formatter)
   	logger.addHandler(file_handler)
   	return logger
	
if __name__ == '__main__':
	try:
		logger = setup_logger()
		sessionKey = settings.get('sessionKey', None)
		owner = settings.get('owner', None)
		namespace = settings.get('namespace', None)
		logger.debug('SessionKey=%s, owner=%s, namespace=%s', sessionKey, owner, namespace)
		if sessionKey is not None:
			for res in results:
				res['session_key'] = sessionKey
		else:
			logger.error("Did not get a session key")
		si.outputResults(results)
	except Exception as e:
		import traceback
		stack =  traceback.format_exc()
		err_results = si.generateErrorResults("Error '%s'" % stack)
		si.outputResults(err_results)

