[app_imports_update://default]
* Configure an input for updating the app imports

apps_to_update = <value>
* This should be a comma separated list of apps that ought to be updated

app_regex = <value>
* This should be a regular expression that matches all of the apps that ought to be added to the imports

app_exclude_regex = <value>
* This should be a regular expression that matches all of the apps that should never be included in the imports

[configuration_check://default]
* Define a configuration check that will be run at intervals and raise error
* messages in the log file and/or the Splunk Message tab.

handler = <value>
* The name of a Python callable object, which will be loaded from the file
* configuration_checks/__init__.py at runtime. The API for this callable is 
 described in the modular input executable script, configuration_check.py.

default_severity = <DEBUG|INFO|WARN|ERROR|CRITICAL|FATAL>
* The default level for messages generated by this configuration check. This 
* governs both messages logged to disk and raised in the UI. UI warnings can be
* further suppressed via required_ui_severity.

required_ui_severity = <DEBUG|INFO|WARN|ERROR|CRITICAL|FATAL>
* The minimum severity required for messages raised by this configuration check 
* to be displayed in the UI. Messages with a lower severity will be suppressed
* from the UI, but NOT from the log file.

suppress = <string>
* A regular expression used to suppress messages raised by this configuration
* check. If matched, no message will be raised in the UI, although log output
* is not affected. Invalid regular expressions are discarded.


[dm_accel_settings://default]
* Configure an input for enforcing data model acceleration settings automatically
* when another app is installed. Note that only one app at a time should define
* the acceleration settings for a given data model. Usually this is the "primary"
* app for the suite of apps on the system, e.g. SplunkEnterpriseSecuritySuite.

acceleration = [true|false]
* True if the data model should be accelerated.

manual_rebuilds = [true|false]
* If true, changes to the datamodel will not automatically rebuild the HPAS
* data store.

