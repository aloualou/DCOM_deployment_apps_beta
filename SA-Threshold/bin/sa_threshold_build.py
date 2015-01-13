#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import logging, logging.handlers
import os
import splunk.entity as en
import splunk.Intersplunk

logger = logging.getLogger('splunk')

if __name__ == '__main__':
	logger.info('Building Thresholds...')
	ENDPOINT = 'admin/conf-sa_threshold'
	
	results,dummyresults,settings = splunk.Intersplunk.getOrganizedResults()
	results = [] # we don't care about incoming results
  
	sessionKey = settings.get('sessionKey', None)
	owner = settings.get('owner', None)
	namespace = settings.get('namespace', None)
	
	if sessionKey is not None:
		logger.info('Retrieving entities from %s' % (ENDPOINT))
		thresholdDict = en.getEntities(ENDPOINT, count=-1, sessionKey=sessionKey, owner=owner, namespace=namespace)
		logger.info(thresholdDict)

		## Iterate status dictionary
		for stanza, settings in thresholdDict.items():
			result = {}
			result['stanza'] = stanza
			
			for key, val in settings.items():
				if not key.startswith('eai'):
					if val is None:
						val = ''
					result[key] = val
				
			results.append(result)
			
	else:
		logger.critical('Unable to retrieve review threshold: Session Key unavailable')
		
	splunk.Intersplunk.outputResults(results)
