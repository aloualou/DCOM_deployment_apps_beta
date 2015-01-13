require([ 'underscore', 'jquery', 'splunkjs/mvc', 'splunkjs/mvc/tableview',
		'splunkjs/mvc/simplexml/ready!' ], function(_, $, mvc, TableView) {
	var CustomRangeRenderer = TableView.BaseCellRenderer.extend({
		canRender : function(cell) {
			return _([ 'CPU Status' ]).contains(cell.field);
		},
		render : function($td, cell) {
			var value = cell.value;
			if (cell.field === 'CPU Status')
				$td.addClass('range-'+value);
			$td.text(value);
		}
	});
	mvc.Components.get('highlight').getVisualization(function(tableView) {
		tableView.table.addCellRenderer(new CustomRangeRenderer());
		tableView.table.render();
	});
});