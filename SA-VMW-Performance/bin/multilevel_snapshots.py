#Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
import sys
import splunk.Intersplunk as si
import logging, logging.handlers
import os
import re
import json

class Usage(Exception):
	def __init__(self, value):
		self.value = value
	def __str__(self):
		return repr(self.value)

def setup_logger():
	"""
	Setup a logger for the search command
	"""
	
	logger = logging.getLogger('multisnapshots')
	logger.setLevel(logging.ERROR)
	
	file_handler = logging.handlers.RotatingFileHandler(os.environ['SPLUNK_HOME'] + '/var/log/splunk/multi_snapshots.log' )
	formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
	file_handler.setFormatter(formatter)
	
	logger.addHandler(file_handler)
	
	return logger

def default_snapshot_results(results):
	results["snapshot_name"].append("N/A")
	results["snapshot_descr"].append("N/A")
	results["snapshot_time"].append("N/A")
	results["snapshot_state"].append("N/A")
	results["snapshot_depth"].append("0")

	return results

(isgetinfo, sys.argv) = si.isGetInfo(sys.argv)
if isgetinfo:
		#outputInfo(streaming, generating, retevs, reqsop, preop, timeorder=False):
		si.outputInfo(True, False, True, False, None, False)
		sys.exit(0)

results,dummyresults,settings = si.getOrganizedResults()



if __name__ == '__main__':
	try:
		logger = setup_logger()
		
		if len(sys.argv) < 3:
			raise Usage(len(sys.argv))
		
		logger.debug(sys.argv)

		#From 'snapshot.rootSnapshotList{}' and 'filenames' in argv, get the corresponding JSON data from results
		ss_name = sys.argv[1]
		f_name = sys.argv[2]
		for r in results:
			ss_data = r[ss_name]
			filenames = r[f_name]
			r["snapshot_name"] = []
			r["snapshot_descr"] = []
			r["snapshot_time"] = []
			r["snapshot_depth"] = []
			r["snapshot_state"] = []

			if (ss_data):
				snapshot = json.loads(ss_data)
				file_id = 0
				depth = 1
				for filename in filenames:
					match = re.search(r'.*(\d)\.vmsn', filename)
					if match:
						file_id = match.group(1)
						logger.debug("Found match for file id:%s and filename:%s" %(file_id,filename))
						if int(file_id)==int(snapshot["id"]):
							r["snapshot_name"].append(snapshot["name"])
							r["snapshot_descr"].append(snapshot["description"])
							r["snapshot_time"].append(snapshot["createTime"])
							r["snapshot_state"].append(snapshot["state"])
							r["snapshot_depth"].append(str(depth))
							if snapshot.has_key('childSnapshotList'):
								snapshot = snapshot['childSnapshotList'][0]
								depth = depth + 1
					else:
						r = default_snapshot_results(r)
			else:
				for filename in filenames:
					r = default_snapshot_results(r)

		logger.debug(results)	
		si.outputResults(results)

	except Usage as e:
		results = si.generateErrorResults("Received '%s' arguments. Usage: multilevelsnapshots rootSnapshotList filename" % e)
		si.outputResults(results)
		
	except Exception as e:
		import traceback
		stack =  traceback.format_exc()
		logger.error("Error '%s'" % stack)
		results = si.generateErrorResults("Error '%s'" % stack)
		si.outputResults(results)
