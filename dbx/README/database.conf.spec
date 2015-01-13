# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
# The file contains configured database connections

[<name>]

host = <string>
* The IP address or the hostname of the database.

port = <integer>
* The port number of the database. If omitted the default port number for the given database type is used.

isolation_level = <string>
* The transaction isolation level which is used against the database.

username = <string>
* The username which is used for authenticating against the database.

password = <string>
* The password which is used for authenticating against the database. It will be automatically encrypted if it is set in
* clear-text.

database = <string>
* The database name or SID.

type = <database_type>
* The database type. References a stanza in database_types.conf

readonly = true|false
* Whether the database connection is read-only. If it is readonly, any modifying SQL statement will be blocked

database.sid = true|false
* Only applies to Oracle database connections (ie. type=oracle). Set to *true* if the Oracle database is only reachable
* using an SID. By default the the service name format is used.

default.schema = <string>
* Sets the default schema for the database connection if the database type supports it (Currently only Oracle supports
* it).

testQuery = <string>
* Supply a specific test query for validating connections to this database
* If defined it overrides the testQuery of the database type (see database_types.conf)

validationDisabled = [true|false]
* Turn off connection validation for this database connection
* If defined it overrides the validationDisabled of the database type (see database_types.conf)
* Caution: disabling validation can lead to unpredictable results when using it with connection pooling

arg.ssl = request|require
* Turn on ssl communication with database. The default is "request".
* This parameter is specific to jTDS driver that allows SSL connection to MS SQL when ssl = require.

arguments = <string>
* Specify additional parameters to establish database connections.