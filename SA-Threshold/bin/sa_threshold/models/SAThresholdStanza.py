#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
from splunk.models.base import SplunkAppObjModel
from splunk.models.field import Field, BoolField

'''
Provides object mapping for the different vmware stanzas
See sa_threshold.conf.spec for a list of stanza attributes that should be defined here
'''

class SAThresholdStanza(SplunkAppObjModel):
	
	resource = 'sa_threshold/sa_threshold_conf'
	
	#Regular ol' disabled definition
	disabled = BoolField()
	#Natural language stanza description
	description = Field()
	#Can be any of the accepted perftype strings
	perftype = Field()
	#Metric is a string matching the perf metrics being monitored exactly
	metric = Field()
	#Critical - level that compared against by comparator will be labelled critical
	critical = Field()
	#Warning - level that compared against by comparator will be labelled warning
	warning = Field()
	#comparison operation to be used, >, <, >=, or <=
	comparator = Field()
	#the thing to which the threshold applies, e.g. HostSystem, VirtualMachine
	entitytype = Field()
	