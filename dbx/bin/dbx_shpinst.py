import os, sys
import getpass
import splunk
import splunk.entity as en
from optparse import OptionParser
from splunk import auth

appName = "dbx"
targetUser = "nobody"
db = ""
parser = OptionParser()
parser.add_option("--user", dest="user", default="", help="splunk user for connecting to splunk")
parser.add_option("--targetuser", dest="targetuser", default="", help="target splunk user to make changes for")
parser.add_option("--db",  dest="db", default="", help="database name in REST")
(opts, args) = parser.parse_args()

user = opts.user
if opts.__dict__["targetuser"]:
   targetUser = opts.targetuser
db = opts.db

if len(args) < 1:
    print "Usage: %s <host:port tuples to push config> [options]" % sys.argv[0]
    print "       Pushes dbx passwords in a search head pool environment."
    sys.exit(1)
    
def main():
  password = getpass.getpass("splunk password:")
  db_pwd = getpass.getpass("database password:")
  for destHost in args:
     tokenized = destHost.split(":")
     hostname = tokenized[0]
     port = 8089
     if len(tokenized) > 1:
        port = int(tokenized[1])     
     hostPath = "https://"+hostname+":"+str(port)
     try:
        sessionKey = auth.getSessionKey(user, password, hostPath=hostPath)
     except splunk.AuthenticationFailed:
        print "Splunk authentication failed."
        sys.exit(-1)
     
     try:
        dbEntity = splunk.entity.getEntity('dbx/databases', db, namespace=appName, owner = targetUser, sessionKey=sessionKey, hostPath=hostPath)
     except:
        print "Could not get entity " + db
        sys.exit(-1)
     
     serverInfo = splunk.entity.getEntity('/server/info', 'server-info', sessionKey=sessionKey, hostPath=hostPath)
     serverName = serverInfo.properties['serverName']
     entityName = db + "@" + serverName
     new = en.Entity('dbx/distributed', entityName, namespace=appName, owner=targetUser)
     new['password'] = db_pwd
     new['validate'] = 'True'
     new.hostPath = hostPath
     try:
        en.setEntity(new, sessionKey=sessionKey)
     except:
        print "Could not validate password"
        sys.exit(-1)
     print "Password at " + serverName +  " set successfully."
if __name__ == "__main__":
  main()
