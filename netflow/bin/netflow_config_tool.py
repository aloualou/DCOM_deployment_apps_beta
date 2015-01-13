import sys
import os
import json
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
import netflow_appname

class ConfigTool():
    def get_key(self, **kwargs):
        value = 'unknown';
        try:
            current_stanza = ''
            all_lines = []
            conf = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', netflow_appname.APP, 'local', kwargs['config'])
            if os.path.exists(conf):
                cf = open(conf, 'r')
                all_lines += cf.readlines()
            conf = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', netflow_appname.APP, 'default', kwargs['config'])
            cf = open(conf, 'r')
            all_lines += cf.readlines()
            # all_lines contains lines from BOTH local/config and contents of default/config
            for line in all_lines:
                line = line.strip()
                if line.startswith('#') or line.startswith(';') or line == '':
                    continue
                if line.startswith('[') and line.endswith(']'):
                    current_stanza = line[1:-1]
                    continue
                parts = line.split('=', 1)
                if len(parts) == 1:
                    continue
                key = parts[0].strip()
                if key == kwargs['key'] and current_stanza == kwargs['stanza']:
                    value = parts[1].strip()
                    # break on the first matching key found
                    # thus, the local/config has a priority over default/config
                    break
        except:
            value = 'unknown';
        return value

    def set_multiple_keys(self, **kwargs):
        try:
            content = []
            current_stanza = ''
            local_dir = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', netflow_appname.APP, 'local')
            if not os.path.exists(local_dir):
                os.makedirs(local_dir)
            conf_write = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', netflow_appname.APP, 'local', kwargs['config'])
            conf_read = conf_write
            if not os.path.exists(conf_read):
                conf_read = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', netflow_appname.APP, 'default', kwargs['config'])
            pairs = json.loads(kwargs['pairs'])
            with open(conf_read, 'r') as cf:
                for line in cf:
                    line = line.strip()
                    if line.startswith('#') or line.startswith(';') or line == '':
                        content.append(line)
                        continue
                    if line.startswith('[') and line.endswith(']'):
                        current_stanza = line[1:-1]
                        content.append(line)
                        continue
                    parts = line.split('=', 1)
                    if len(parts) == 1:
                        continue
                    key = parts[0].strip()
                    value = parts[1].strip()
                    if key in pairs.keys() and current_stanza == kwargs['stanza']:
                        value = pairs[key]
                        del pairs[key]
                    content.append(key+'='+value)
            for k, v in pairs.items():
                content.append(k+'='+v)
            with open(conf_write, 'w') as cf:
                for line in content:
                    print >> cf, line
        except Exception as e:
            return str(e)
        return '1'

