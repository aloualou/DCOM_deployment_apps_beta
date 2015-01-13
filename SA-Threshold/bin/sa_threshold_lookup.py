#!/usr/bin/env python
#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import sys
import splunk.entity as en
from splunklib.searchcommands import \
	dispatch, StreamingCommand, Configuration, Option, validators

import operator

@Configuration()
class thresholdlookupCommand(StreamingCommand):
	""" %(synopsis)

	##Syntax

	|thresholdlookup entitytype=<entity> perftype=<perftype> metric=<metric> match=True/False

	##Description
	
	This command will look at a "metric" then match it in a sa_threshold.conf file and compare it's value, returning the severity.

	"""
	entitytype = Option(
		doc='''
		**Syntax:** **entity=***<entity>*
		**Description:** Name of the entitytype to match in sa_threshold.conf''',
		require=True, validate=validators.Fieldname())

	metric = Option(
		doc='''
		**Syntax:** **metric=***<metric>*
		**Description:** Name of the metric to match in sa_threshold.conf''',
		require=True, validate=validators.Fieldname())

	match = Option(
		doc='''
		**Syntax:** **match=***<match>*
		**Description:** True/False, used to tell the command if it should compare the metric value or just return the thresholds, True will only return the values, False will compare the values ''',
		require=False, validate=validators.Fieldname())
		
	perftype = Option(
		doc='''
		**Syntax:** **perftype=***<perftype>*
		**Description:** Name of the perftype to match in sa_threshold.conf''',
		require=True, validate=validators.Fieldname())

	def stream(self, events):
		sessionKey=self.service.token
		ENDPOINT = 'admin/conf-sa_threshold'
		owner = self.service.namespace["owner"] if self.service.namespace["owner"] else 'nobody'
		app = self.service.namespace["app"]
		self.logger.debug('Building Thresholds...')
		self.logger.debug('CountMatchesCommand: %s' % self)  # logs command line
		search = "entitytype={0} perftype={1} metric={2} disabled=0".format(self.entitytype, self.perftype, self.metric)
		targetEntity = en.getEntities(entityPath=ENDPOINT, namespace=app, owner=owner, search=search, count=1, sessionKey=sessionKey).values()
		if len(targetEntity) > 0:
			targetEntity = targetEntity[0]
		else:
			targetEntity = False
		matchFields = True
		if self.match:
			matchValue = self.match.lower()
			if matchValue == "true" or matchValue =="t" or matchValue == "1":
				matchFields = True
			else:
				matchFields = False

		self.logger.debug("Target Stanza: '%s'", targetEntity)
		
		# avoid repeated indexing operations
		metric = self.metric
		if targetEntity:
			threshold = targetEntity.properties
		else:
			threshold = {}
		thresholdCrit = threshold.get('critical', None)
		thresholdWarn = threshold.get('warning', None)
		if thresholdCrit is None:
			thresholdCrit = ""
		else:
			thresholdCrit = float(thresholdCrit)
		if thresholdWarn is None:
			thresholdWarn = ""
		else:
			thresholdWarn = float(thresholdWarn)
		# Setting severity for matchFields=true
		if  matchFields:
			comparator = threshold.get('comparator','')
		else:
			comparators = {'<': operator.lt,
					'<=': operator.le,
					'==': operator.eq,
					'>=': operator.ge,
					'>': operator.gt}
			comparator = comparators[threshold.get('comparator', '==')]
		# Setting result attributes 	
		for event in events:
			self.logger.debug("Contains target metric : '%s'", (metric in event) ) 
			self.logger.debug("Results '%s'", event )
			# Check for macthFields again and avoid co,
			if matchFields or (threshold.get('comparator', None) is None):
				event['threshold_severity'] = "unchecked"
			else:
				if not all(v == "" for v in event.values()):
					if metric in event and event[metric] != '':
						try:
							curr = float(event[metric])
						except ValueError:
							self.logger.error( "Metric value could not be converted to float: %s | event: %s" % (event[metric],event)) 
							event['threshold_severity'] = "unknown"
							continue
						self.logger.debug("Results Metric Value: '%s'", event[metric])
						if comparator(curr, thresholdCrit):
							self.logger.debug( "Value is critical")
							event['threshold_severity'] = "critical"
						elif comparator(curr, thresholdWarn):
							self.logger.debug( "Value is warning")
							event['threshold_severity'] = "warning"
						else :
							self.logger.debug( "Value is normal")
							event['threshold_severity'] = "normal"
					else :
						self.logger.debug( "Metric Missing" ) 
						event['threshold_severity'] = "unknown"
			event['threshold_critlevel'] = thresholdCrit
			event['threshold_warnlevel'] = thresholdWarn
			event['threshold_comparator'] = threshold.get('comparator', '')
			self.logger.debug("Yielding this event to splunk: %s", event )
			yield event
		
dispatch(thresholdlookupCommand, sys.argv, sys.stdin, sys.stdout, __name__)
