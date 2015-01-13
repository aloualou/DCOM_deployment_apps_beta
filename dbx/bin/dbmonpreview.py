# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import os
import sys
from spp.java.bridge import JavaBridge, JavaBridgeError

from splunk import Intersplunk as si
from splunk import entity as en

if __name__ == '__main__':
    (isInfo, sys.argv) = si.isGetInfo(sys.argv)
    keywords = sys.argv[1:]
    
    if isInfo:
        si.outputInfo(False, True, True, False, None, False)
    
    stdin = None
    if not os.isatty(0):
        stdin = sys.stdin
    
    settings = dict()
    records = si.readResults(settings = settings, has_header = True)
    sessionKey = settings['sessionKey']
    
    ent = en.getEntity(["configs","conf-inputs"], keywords[0], namespace="dbx", owner="nobody", sessionKey=sessionKey)    
    parameters = ['output.timestamp', 
                  'output.timestamp.column',
                  'output.timestamp.format', 
                  'tail.rising.column',
                  'output.template',
                  'output.fields', 
                  'query', 
                  'output.format', 
                  'table']

    for par in parameters:
        val = ent[par] if ent.properties.has_key(par) and ent[par]!=None else ""
        keywords.append("%s=%s" %(par,val))
    
    try:
        sys.exit(JavaBridge(stdin=stdin).execute("com.splunk.dbx.monitor.Preview", *keywords))
    except JavaBridgeError, e:
        print 'ERROR\n"%s"' % e