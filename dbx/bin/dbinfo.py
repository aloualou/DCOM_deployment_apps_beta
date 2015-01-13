# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import os
import sys
from spp.java.bridge import JavaBridge, JavaBridgeError
from splunk import Intersplunk as si
from splunk import entity as en

(isInfo, sys.argv) = si.isGetInfo(sys.argv)

if isInfo:
    # TODO: Parameter validation
    si.outputInfo(False, True, False, False, None, False)

else:
    keywords, kvs = si.getKeywordsAndOptions()
    dbn = kvs.get("database", None)
    try:
        if dbn is None: raise Exception
        settings = dict()
        si.readResults(settings = settings, has_header = True)
        sessionKey = settings['sessionKey']
        ent = en.getEntity(["dbx", "databases"], entityName=dbn, namespace="dbx", owner="nobody", sessionKey=sessionKey)
    except Exception as ex:
        print "There is no such database [%s] available for this user!" % dbn
        sys.exit(1)

stdin = None
if not os.isatty(0):
    stdin = sys.stdin

try:
    sys.exit(JavaBridge(stdin=stdin).execute("com.splunk.dbx.command.DatabaseInfoCommand", *sys.argv[1:]))
except JavaBridgeError, e:
    print 'ERROR\n"%s"' % e