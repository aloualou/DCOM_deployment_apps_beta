from distutils.version import LooseVersion
import distutils.dir_util as dir_util
import logging
import logging.handlers
import os
import sys
import re
from pprint import pprint

import splunk
import splunk.entity
import splunk.appserver.mrsparkle.lib.util as app_util

SPLUNK_HOME = os.environ.get('SPLUNK_HOME')
INSTALLER_LOG_FILENAME = os.path.join(SPLUNK_HOME,'var','log','splunk','stream_installer.log')
STREAMFWD_LOG_FILENAME = os.path.join(SPLUNK_HOME,'var','log','splunk','streamfwd.log')
logger = logging.getLogger('stream_installer')
logger.setLevel(logging.DEBUG)
handler = logging.handlers.RotatingFileHandler(INSTALLER_LOG_FILENAME, maxBytes=1024000, backupCount=5)
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
handler.setLevel(logging.DEBUG)
logger.addHandler(handler)

APP_NAME = 'splunk_app_stream'
APPS_DIR = app_util.get_apps_dir()
(ETC_DIR, APPS_STEM) = os.path.split(APPS_DIR)
DEPLOYMENT_APPS_DIR = os.path.join(ETC_DIR, 'deployment-apps')
INSTALL_DIR = os.path.join(APPS_DIR, APP_NAME, 'install')
SPLUNK_PROTOCOL = 'http'
SPLUNK_HOST = 'localhost'
SPLUNK_PORT = '8000'
SPLUNK_ROOT_ENDPOINT = '/'
STREAM_PATH = 'en-us/custom/splunk_app_stream/'
DEPENDENCIES = ['Splunk_TA_stream']

def create_inputs(appdir, location, disabled):
    localdir = os.path.join(appdir, 'local')
    if not os.path.exists(localdir):
        os.makedirs(localdir)
    inputs_file = os.path.join(localdir, 'inputs.conf')
    fo = open(inputs_file, 'w')
    fo.write( "[streamfwd://streamfwd]\n")
    fo.write( "splunk_stream_app_location = %s\n" % location)
    fo.write( "disabled = %d\n" % disabled)
    fo.close()
    logger.info("created config file (disabled=%d): %s" % (disabled, inputs_file)) 

def update_log_config(appdir):
    config_file = os.path.join(appdir, 'default', 'streamfwdlog.conf')
    if os.path.exists(config_file):
        with open(config_file, "r") as logconf:
            lines = logconf.readlines()
        with open(config_file, "w") as logconf:
            for line in lines:
                logconf.write(re.sub(r'^log4cplus.appender.streamfwdlog.File=.*',
                    "log4cplus.appender.streamfwdlog.File=%s" % STREAMFWD_LOG_FILENAME.encode('string-escape'), line))

def install_dependency(dep):
    src = os.path.join(INSTALL_DIR, dep)
    dst = os.path.join(APPS_DIR, dep)
    try:
        dir_util.copy_tree(src, dst)
        logger.info("%s was successfully copied to %s" % (src, dst)) 
        if (dep == "Splunk_TA_stream"):
            location = ( "%s://%s:%s%s%s" % (SPLUNK_PROTOCOL, 'localhost', SPLUNK_PORT, SPLUNK_ROOT_ENDPOINT, STREAM_PATH) )
            create_inputs(dst, location, 1)
            update_log_config(dst)
        if os.path.exists(DEPLOYMENT_APPS_DIR):
            dst = os.path.join(DEPLOYMENT_APPS_DIR, dep)
            dir_util.copy_tree(src, dst)
            logger.info("%s was successfully copied to %s" % (src, dst)) 
            if (dep == "Splunk_TA_stream"):
                location = ( "%s://%s:%s%s%s" % (SPLUNK_PROTOCOL, SPLUNK_HOST, SPLUNK_PORT, SPLUNK_ROOT_ENDPOINT, STREAM_PATH) )
                create_inputs(dst, location, 0)
                update_log_config(dst)
            
    except Exception, ex:
        logger.error("unable to copy %s to %s" % (src, dst)) 
        logger.exception(ex)

def get_loose_version(version, build):
	pattern = re.compile('(\d+\.\d+).*')
	m = pattern.match(version)
	if m:
		version = m.group(1)
	version = "%s build %s" % (version, build)
	return LooseVersion(version)

if __name__ == '__main__':

    token = sys.stdin.readlines()[0]
    token = token.strip()

    logger.info("Splunk App for Stream Dependency Manager: Starting...")
   
    en = splunk.entity.getEntity('server/settings', 'settings', sessionKey=token)
    if (en):
        SPLUNK_PROTOCOL = ("https" if int(en['enableSplunkWebSSL'])==1 else "http")
        SPLUNK_HOST = en['host']
        SPLUNK_PORT = en['httpport']
    else:
        logger.error("unable to retrieve server settings")

    en = splunk.entity.getEntity('configs/conf-web', 'settings', sessionKey=token)
    if (en and 'root_endpoint' in en):
        SPLUNK_ROOT_ENDPOINT = en['root_endpoint']
        if not SPLUNK_ROOT_ENDPOINT.startswith('/'):
            SPLUNK_ROOT_ENDPOINT = "/" + SPLUNK_ROOT_ENDPOINT
        if not SPLUNK_ROOT_ENDPOINT.endswith('/'):
            SPLUNK_ROOT_ENDPOINT += '/'
    else:
        logger.error("unable to retrieve root_endpoint setting")

    en = splunk.entity.getEntities('/apps/local', sessionKey=token)
    keys = en.keys()
    version = get_loose_version(en[APP_NAME]['version'], en[APP_NAME]['build'])

    for dep in DEPENDENCIES:
        if not dep in keys:
            logger.info("dependency %s not found - installing..." % dep)
            install_dependency(dep)
        else:
            dep_version = get_loose_version(en[dep]['version'], en[dep]['build'])
            if version > dep_version:
                logger.info("installed version of %s is %s, which is older than required version %s - updating..." % (dep, dep_version, version))
                install_dependency(dep)
            else:
                logger.info("installed version of %s is %s, which is newer or equal to version %s - leaving alone..." % (dep, dep_version, version))

    logger.info("Splunk App for Stream Dependency Manager: Exiting...") 
      
