import sys
import os
import splunk.Intersplunk
import splunk.rest
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
import netflow_appname

def processResult(sk, exp_ip, cont, commstr, pollint, index):
    if ('<s:key name="destination">' + exp_ip + '</s:key>') in cont:
        return
    resp2,cont2 = splunk.rest.simpleRequest(path='/services/data/inputs/snmp', \
                                            sessionKey=sk, \
                                            method='POST', \
                                            postargs = {'name': 'netmon_auto_'+exp_ip, \
                                            'destination': exp_ip, \
                                            'do_bulk_get': '1', \
                                            'split_bulk_output': '1', \
                                            'object_names': '1.3.6.1.2.1.2.2.1.5,1.3.6.1.2.1.2.2.1.2,1.3.6.1.2.1.1.5', \
                                            'snmpinterval': pollint, \
                                            'communitystring': commstr, \
                                            'index': index, \
                                            'sourcetype': 'snmp_ta'})
    return

results,dummy,settings = splunk.Intersplunk.getOrganizedResults()
sk = settings["sessionKey"]
resp,cont = splunk.rest.simpleRequest(path='/servicesNS/nobody/'+netflow_appname.APP+'/properties/nfi_auto_snmp/nfi/enable', sessionKey=sk, method='GET')
enabled = int(cont)
if enabled == 1:
    resp,commstr = splunk.rest.simpleRequest(path='/servicesNS/nobody/'+netflow_appname.APP+'/properties/nfi_auto_snmp/nfi/commstr', sessionKey=sk, method='GET')
    resp,pollint = splunk.rest.simpleRequest(path='/servicesNS/nobody/'+netflow_appname.APP+'/properties/nfi_auto_snmp/nfi/pollint', sessionKey=sk, method='GET')
    resp,index = splunk.rest.simpleRequest(path='/servicesNS/nobody/'+netflow_appname.APP+'/properties/nfi_auto_snmp/nfi/index', sessionKey=sk, method='GET')
    resp,cont = splunk.rest.simpleRequest(path='/services/data/inputs/snmp', sessionKey=sk, method='GET')
    for result in results:
        if result["management_ip"] != "unknown":
            processResult(sk, result["management_ip"], cont, commstr, pollint, index)
        else:
            processResult(sk, result["exp_ip"], cont, commstr, pollint, index)
splunk.Intersplunk.outputResults(results)

