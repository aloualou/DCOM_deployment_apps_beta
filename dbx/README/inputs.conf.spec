# Copyright (C) 2005-2014 Splunk Inc. All Rights Reserved.
# This file contains the database monitor definitions

[dbmon-<type>://<database>/<unique_name>]

interval = auto|<relative time expression>|<cron expression>
* Use to configure the schedule for the given database monitor.
* Schedule types:
* - auto - The scheduler automatically chooses an interval based on the number of generated results.
* - relative time expression - The number of seconds or a relative time expression.
*   Examples:
*           interval = 60 (run every 60 seconds)
*           interval = 1h (run every hour)
* - cron expression
*   Examples:
*           interval = 0/15 * * * *       (run every 15 minutes)
*           interval = 0 18 * * MON-FRI * (run every weekday at 6pm)

query = <string>
* The query options defines the exact SQL query executed against the database

table = <string>
* If a query is not specified, DBmon automatically creates a SQL query from the given table name (e.g., SELECT * FROM <table>)

output.format = [kv|mkv|csv|template]
* The output format.
* Format types:
* - kv: Simple key-value pairs.
* - mkv: Multiline key-value pairs (i.e., each key-value pair is printed on its own line.)
* - csv: CSV-formatted events.
* - template: Specify the generated events using the <output.template> or <output.template.file> options.

output.template = <string>

output.template.file = <string>

output.timestamp = [true|false]
* Controls whether or not the generated event is prefixed with a timestamp value.

output.timestamp.column = <string>
* The column of the result set from which the timestamp is fetched. If this is omitted, the monitor execution time
* is used as the timestamp value.

output.timestamp.format = <string>
* The format of the output timestamp value expressed as a Java SimpeDateFormat pattern.

output.timestamp.parse.format = <string>
* Used when the timestamp in the column defined by <output.timestamp.column> is a string value 
* (i.e.,varchar, nvarchar, etc). It permits you to define the (SimpleDateFormat) pattern for parsing the timestamp.

output.fields = <list>
* The fields to print in the generated event.

# A Tail Database monitor remembers the value of a column in the result and only fetches entries with a higher value
# in future executions.

# The following two fields are only valid at dbmon-tail. Putting here to avoid warning messages during initialization.
tail.rising.column = <string>
* A column with a value that is always rising. The best option is to use an auto-incremented value or a sequence. A
* creation or last-update timestamp is a good choice.

tail.follow.only = [true|false]
* If this options is set to true nothing is indexed on the first run (default is false).
* This only affects the first execution of the monitor. 

[dbmon-tail://<database>/<unique_name>]

tail.rising.column = <string>
* A column with a value that is always rising. The best option is to use an auto-incremented value or a sequence. A
* creation or last-update timestamp is a good choice.

tail.follow.only = [true|false]
* If this options is set to true nothing is indexed on the first run (default is false).
* This only affects the first execution of the monitor. 

[dbmon-dump://<database>/<unique_name>]

[dbmon-change://<database>/<unique_name>]

change.hash.algorithm = MD5|SHA256

[dbmon-batch://<database>/<unique_name>]
