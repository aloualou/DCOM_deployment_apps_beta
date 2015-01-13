# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import sys
from spp.java.bridge import JavaBridge, JavaBridgeError

from splunk import Intersplunk as si
import splunk.entity as en

if sys.argv[1] == "__EXECUTE__":
    try:
        settings = dict()
        si.readResults(settings = settings, has_header = True)
        sessionKey = settings['sessionKey']
        dbn = sys.argv[2].strip("\"")
        ent = en.getEntity(["dbx", "databases"], entityName=dbn, namespace="dbx", owner="nobody", sessionKey=sessionKey)
    except Exception as ex:
        print "There is no such database [%s] available for this user!" % dbn
        sys.exit(1)

try:
    sys.exit(JavaBridge(stdin=sys.stdin).execute("com.splunk.dbx.command.DatabaseQueryCommand", *sys.argv[1:]))
except JavaBridgeError, e:
    print 'ERROR\n"%s"' % e