# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import sys,os
import signal
from spp.java import JavaEnv
from spp.java.bridge import executeBridgeCommand
from spp.util import getConfInContext

import logging

DEFAULT_CONF = "jbridge_server"
DEFAULT_MAX_LOGFILE_BYTES = 100000000
DEFAULT_MAX_LOGFILE_COUNT = 5
DEFAULT_LOG_FILENAME = 'jbridge.log'
DEFAULT_LOG_LEVEL = logging.INFO 
appName = 'dbx'

def getLogConfig(sessionKey=None, appName=appName, cfgName=DEFAULT_CONF):
   logConfig = dict()
   logConfig['filename'] = DEFAULT_LOG_FILENAME
   logConfig['maxCount'] = DEFAULT_MAX_LOGFILE_COUNT
   logConfig['fileSize'] = DEFAULT_MAX_LOGFILE_BYTES
   logConfig['logLevel'] = DEFAULT_LOG_LEVEL 
   
   try:
       rawConfig = getConfInContext(cfgName, appName)
   except:
       return logConfig 
   
   if 'log' not in rawConfig:
      return logConfig
      
   if 'filename' in rawConfig['log']:
      logConfig['filename'] = rawConfig['log'].get('filename')
   
   if 'logLevel' in rawConfig['log']:
      logLevel = rawConfig['log'].get('logLevel').upper() 
      if (logging._levelNames.get(logLevel)):
         logConfig['logLevel'] = logging._levelNames.get(logLevel)
   
   if 'maxCount' in rawConfig['log']:
      logConfig['maxCount'] = int(rawConfig['log'].get('maxCount'))
   
   if 'fileSize' in rawConfig['log']:
      logConfig['fileSize'] = int(rawConfig['log'].get('fileSize'))
      
   return logConfig

#setup logging
logConfig = getLogConfig()
logFilename = os.path.join(os.environ['SPLUNK_HOME'], 'var', 'log', 'splunk', logConfig['filename']) 
handler = logging.handlers.RotatingFileHandler(filename=logFilename, mode='a', maxBytes=logConfig['fileSize'], backupCount=logConfig['maxCount'])
logger = logging.getLogger('spp.dbx.javabridge')
logger.setLevel(logConfig['logLevel'])
formatter = logging.Formatter(fmt='%(asctime)s %(levelname)s %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

def log(msg):
    logger.debug(msg)


try:
    executeBridgeCommand("com.splunk.bridge.cmd.Shutdown", checkStatus=True)
    log("JavaBridgeServer was still running...")
except:
    pass

java = JavaEnv()
OBSOLETE = ("jtds-1.2.jar")
logger.info("Checking for obsolete java libraries in %s", java.lib_path)
for file in os.listdir(java.lib_path):
    if file in OBSOLETE:
        logger.info("Deleting obsolete jar file %s", file)
        os.remove(os.path.join(java.lib_path, file))
logger.debug("Starting JavaBridgeServer...")
process = java.execute("com.splunk.bridge.JavaBridgeServer", [str(os.getpid())])
logger.info("Started JavaBridgeServer PID=%d", process.process.pid)


def signal_cleanup(s, f):
    cleanup()


def cleanup():
    log("cleanup callback... terminating process")
    try:
        log("sending shutdown command to jbridge server")
        executeBridgeCommand("com.splunk.bridge.cmd.Shutdown", checkStatus=True)
    except Exception, e:
        log("Error terminating process: %s" % e)
    try:
        log("terminating jbridge process")
        process.terminate()
    except:
        log("Error terminating jbridge process")
    log("termining wrapper process sys.exit(1)")
    sys.exit(1)


watcher = None
running = True

if os.name == 'nt':
    try:
        def win32sighandler(*args):
            logger.debug("WIN32 SIGNAL %s", args)
            cleanup()
            return True

        import win32api

        win32api.SetConsoleCtrlHandler(win32sighandler, True)
        logger.debug("win32 handler registered")
    except Exception, e:
        log.error("Error registering Win32 callback: %s", e)
else:
    signal.signal(signal.SIGTERM, signal_cleanup)

    if hasattr(os, 'uname') and os.uname()[0] == 'Linux':
        from threading import Thread
        import time

        class PPIDWatcher(Thread):
            def __init__(self):
                super(PPIDWatcher, self).__init__()

            def run(self):
                ppid = os.getppid()
                while running:
                    time.sleep(1)
                    try:
                        os.kill(ppid, 0)
                    except:
                        logger.warn("Parent process pid=%d vanished. Shutting down Javabridge Server.", ppid)
                        cleanup()
                        break

        log("starting pid watcher...")
        watcher = PPIDWatcher()
        watcher.start()

try:
    process.waitFor(checkReturnCode=True)
except Exception, e:
    log("Error waiting for process: %s" % e)
running = False
log("JavaBridgeServer terminated")
if watcher: watcher.join()
sys.exit(0)
