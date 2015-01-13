import sys
import os
import shutil
import splunk.rest
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
import netflow_csv_checker
import netflow_nav_builder

OBSOLETE_FILES = [  'appserver/static/restart_30.png',              \
                    'appserver/static/stop_30.png',                 \
                    'appserver/static/server_restart_loader.gif',   \
                    'appserver/static/server_restart_bg.gif',       \
                    'appserver/static/screenshot.png',              \
                    'appserver/static/button_bg.png',               \
                    'appserver/static/controller.js',               \
                    'appserver/static/styles.css',                  \
                    'appserver/static/play_30.png',                 \
                    'appserver/controllers/get_version.py',         \
                    'appserver/controllers/netflow_controller.py',  \
                    'bin/kill_nfcapd.sh',                           \
                    'bin/netflow_setup_handler.py',                 \
                    'bin/netflow_parse_ini.py',                     \
                    'bin/netflow_parse_ini.pyo',                    \
                    'bin/netflow_parse_ini.pyc',                    \
                    'bin/netflow_common.py',                        \
                    'bin/netflow_common.pyo',                       \
                    'bin/netflow_common.pyc',                       \
                    'bin/netflow_keep_alive.py',                    \
                    'bin/netflow_cleaner.py',                       \
                    'bin/netflow_cleaner.pyo',                      \
                    'bin/netflow_cleaner.pyc',                      \
                    'local/viewstates.conf',                        \
                    'local/savedsearches.conf',                     \
                    'local/netflow_setup.conf',                     \
                    'lookups/exporter-groups.csv.sample',           \
                    'lookups/management-ip.csv.sample',             \
                    'lookups/netflow-exporters.csv.sample',         \
                    'lookups/exporter-groups.csv',                  \
                    'lookups/management-ip.csv',                    \
                    'lookups/netflow-exporters.csv']

OBSOLETE_DIRS = [   'metadata',                     \
                    'logs',                         \
                    'bin/flowintegrator_linux64',   \
                    'bin/flowintegrator_linux32',   \
                    'bin/flowintegrator_windows',   \
                    'bin/packages']

class Updater(splunk.rest.BaseRestHandler):
    def handle_GET(self):
        csvc = netflow_csv_checker.CSVChecker()
        csvc.check()
        navb = netflow_nav_builder.NavBuilder()
        navb.rebuild_nav()
        for f in OBSOLETE_FILES:
            try:
                os.remove(os.path.normpath(os.path.join(os.path.dirname(__file__), '..', os.path.normpath(f))))
            except:
                pass
        for d in OBSOLETE_DIRS:
            try:
                shutil.rmtree(os.path.normpath(os.path.join(os.path.dirname(__file__), '..', os.path.normpath(d))))
            except:
                pass
        self.response.setStatus(200)
        self.response.setHeader('content-type', 'text/html')
        self.response.write('Updated')
        return
