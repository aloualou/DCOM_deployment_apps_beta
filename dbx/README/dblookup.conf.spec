# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
# This file contains the configured database lookup definitions

[<name>]

database = <database>
* the database. References a stanza in database.conf

table = <string>
* the database table name. Only used in simple mode (advanced = 0).

fields = <csv-list>
* list of fields/columns for as input for the SQL query template
* it is possible to simply specify the field or the field and the column in the form: <field> as <sql-column>

advanced = [1|0]
* whether to perform a simple lookup against the table or use a custom SQL query

query = <string>
* a SQL query template. Expressions in the form of $fieldname$ are replaced with the input provided by splunk.

input_fields = <csv-list>
* list of fields/columns for use as input for the SQL query template

max_matches = <n>
* Maximum number of results fetched from the database for each lookup input row
* Defaults to 1