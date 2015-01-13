#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import sys,splunk.Intersplunk
import time

results = []
actual = set()
newresults = {}


try:
    results,dummyresults,settings = splunk.Intersplunk.getOrganizedResults()
    
    for result in results:
        for key in result:
            if (result[key]) :
                actual.add(key)

except:
    import traceback
    stack =  traceback.format_exc()
    newresults = splunk.Intersplunk.generateErrorResults("Error : Traceback: " + str(stack))

newresults['uniqueFieldList'] = list(actual)
newresults['_time'] = time.time()

splunk.Intersplunk.outputResults([ newresults ])
