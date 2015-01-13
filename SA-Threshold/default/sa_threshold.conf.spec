#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
#
# This file contains possible attribute / value pairs for configuring the
# behavior of the vmware application on your search heads.  This file is
# used to define limits and behavior of certain panels in the view.
# These options can also be configured through the app itself on the
# "Configuration" page

#*******
# GENERAL SETTINGS:
#The possible attribute / value pairs for the vmware stanzas
# You must first enter a stanza header in square brackets, specifying the input type. See further down 
# in this file for examples.   
# Then, use any of the following attribute/value pairs.
#*******

[stanza]
* The label associated with the specific settings

disabled = [1|0]
* Enable (0) or disable (1) this stanza.

description = <string>
* Additional text used to describe the stanza

perftype = [cpu|mem|net|disk]
* The perftype the stanza applies to

metric = field
* A string matching the performace metric being monitored

critical = <number>
* A value that when compared against by comparator on the metric should be considered as "critical"

warning = <number>
* A value that when compared against by comparator on the metric should be considered as "warning"

compatator = [>|<|<=|>=]
* The comparason operation used to qualify metric values against thresholds, critical and warning

entitytype = [HostSystem|VirtualMachine]
* the class of managed object for which this threshold holds
