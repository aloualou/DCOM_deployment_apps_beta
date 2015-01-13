import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
import netflow_config_tool
import netflow_appname

class NavBuilder():
    def rebuild_nav(self, **kwargs):
        try:
            confh = netflow_config_tool.ConfigTool()
            confdir = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', netflow_appname.APP, 'local', 'data', 'ui', 'nav')
            if not os.path.exists(confdir):
                os.makedirs(confdir)
            conf_write = os.path.join(confdir, 'default.xml')
            conf_read = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', netflow_appname.APP, 'default', 'data', 'ui', 'nav', 'full.xml')
            cf = open(conf_read, 'r')
            content = cf.readlines()
            cf.close()
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='cyber_threat_enabled') == '0':
                content[32] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='traffic_by_qos_enabled') == '0':
                content[38] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='traffic_by_subnets_enabled') == '0':
                content[9] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='traffic_by_as_enabled') == '0':
                content[37] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='top_host_pairs_enabled') == '0':
                content[8] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='traffic_by_connections_enabled') == '0':
                content[11] = ''
                content[12] = ''
                content[13] = ''
                content[14] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='cisco_asa_enabled') == '0':
                content[40] = ''
                content[41] = ''
                content[42] = ''
                content[43] = ''
                content[44] = ''
                content[45] = ''
                content[46] = ''
                content[66] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='palo_enabled') == '0':
                content[47] = ''
                content[48] = ''
                content[49] = ''
                content[50] = ''
                content[51] = ''
                content[52] = ''
                content[53] = ''
                content[54] = ''
                content[55] = ''
                content[56] = ''
                content[57] = ''
                content[58] = ''
                content[59] = ''
                content[60] = ''
                content[61] = ''
                content[62] = ''
                content[63] = ''
                content[67] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='services_response_time_enabled') == '0':
                content[29] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='dns_monitor_enabled') == '0':
                content[33] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='geo_ip_monitor_enabled') == '0':
                content[36] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='watched_interfaces_enabled') == '0':
                content[25] = ''
            if confh.get_key(config='nfi_sections.conf', stanza='nfi', key='interface_groups_enabled') == '0':
                content[26] = ''
            with open(conf_write, 'w') as cf:
                for line in content:
                    print >> cf, line,
        except Exception as e:
            return str(e)
        return '1'

