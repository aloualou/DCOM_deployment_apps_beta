# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
# This file contains the database type definitions

[<name>]

displayName = <string>
* A descriptive display name for the database type.

typeClass = <string>
* The FQCN (fully qualified class-name) of a class implementing the com.splunk.dbx.sql.type.DatabaseType interface.

jdbcDriverClass = <string>
* The FQCN of the JDBC Driver class. Only used when no typeClass is specified.

defaultPort = <integer>
* The default TCP port for the database type. Only used when no typeClass is specified.

connectionUrlFormat = <string>
* The JDBC URL as a MessageFormat string. The following values will be replaced:
* {0} the database host
* {1} the database port (the port specified in database.conf or the default port)
* {2} the database name/catalog or SID
* Only used when no typeClass is specified.

testQuery = <string>
* A simple SQL that is used to validate the database connection. Only used when no typeClass is specified.

supportsParameterMetaData = [true|false]
* Whether the given JDBC driver supports metadata for java.sql.PreparedStatement.
* Only used when no typeClass is specified.

quoteChars = <string>
* Override the quote characters for the database type. If not specified the default ANSI-SQL quote characters will be used.
* Only used when no typeClass is specified.

defaultCatalogName = <string>
* Configure the default catalog name for a generic database type. Used for querying the catalog names (ie. databases)

local = true|false
* This flag marks a database type as local (ie. it is accessed via the filesystem instead of TCP)

defaultSchema = <string>
* Set the default schema prefix for the database type (defaults to null)

streamingFetchSize = <n>
* Number of results to be fetched at a time when streaming is enabled for a JDBC statement.

streamingAutoCommit = [true|false]
* Turn auto-commit on or off for java.sql.Connection instances in streaming mode

validationDisabled = [true|false]
* Turn off connection validation for database connections of this type
* Defaults to false
* Caution: this can lead to unpredictable results when using this with connection pooling