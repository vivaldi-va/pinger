/**
 * Created by vivaldi on 12/05/2015.
 */

var blessed = require('blessed');
var Canvas = require('drawille');
var program = require('commander');

var ip;
var values = exports.values = [];
var highVal = 0;
var traces = 0;
var cachedAverage = 0;
var height;

var screen;
var graph;
var headerText;
var header;
var lastTrace;
var maxYValue = 500;

var graphDimensions = {
	width: 0,
	height: 0
};




/*var updateLastTrace = function() {
	var lastTraceString = "Last trace: " + values[values.length - 1] + "ms | Values: " + values.length + " | Average: " + averagePing() + "ms | Highest Trace: " + highVal + "ms | Packet loss: " + packetLoss() + "%";
	lastTrace.setContent(lastTraceString);
	lastTrace.width = lastTraceString.length;
	screen.render();
};*/

var boxMullerRandom = (function () {
	var phase = 0;
	var random = Math.random;
	var x1, x2, w, z;

	return function () {
		if (!phase) {
			do {
				x1 = 2.0 * random() - 1.0;
				x2 = 2.0 * random() - 1.0;
				w = x1 * x1 + x2 * x2;
			} while (w >= 1.0);

			w = Math.sqrt((-2.0 * Math.log(w)) / w);
			z = x1 * w;
		} else {
			z = x2 * w;
		}

		phase ^= 1;

		return z;
	}
}());

var getPing = function(cb) {
	var lastValue = values[values.length - 1] || 0;
	var value = Math.abs(Math.floor(lastValue + (boxMullerRandom() * 10)));
	cb(null, value);
};

var computeY = function(height, input) {
	//var ceil =
	var processedHighVal = highVal || input;
	if(input > maxYValue) {
		processedHighVal = maxYValue;
	}
	var y  = height - Math.floor(((height + 1) / 100) * ((input / processedHighVal)*100)) + 1;
	//console.log('y: %d', y, "height: %d", height, "input %d", input, "high val %d", processedHighVal);
	return y;
	//return height - Math.floor(((height + 1)/100)*input);
};

exports.computeY = computeY;

var drawChart = function(chart, data, cb) {

	for(var pos = 0; pos < values.length; pos += 1) {
		var x = pos + (graphDimensions.width - values.length);
		var y = computeY(graphDimensions.height, values[pos]);

		for(y; y < graphDimensions.height; y += 1) {
			chart.set(x, y);
		}
		//console.log(x, y);

		//console.log("chart: ", chart);

		//process.exit(0);
	}

	cb(null, chart.frame());

};

var init = function (cb) {

	console.log('init');

	screen = blessed.screen();

	graph = blessed.box({
		top: 'top',
		left: 'left',
		width: '100%',
		height: '100%',
		content: '',
		tags: true,
		border: {
			type: 'line'
		}
	});

	headerText = "Pinging " + "test";
	header = blessed.text({
		top: 'top',
		left: 1,
		width: headerText.length,
		height: '1',
		fg: 'white',
		content: headerText,
		tags: true
	});

	var valuesLengthText = String(values.length);

	lastTrace = blessed.text({
		top: 'top',
		right: 1,
		width: 3,
		height: '1',
		fg: 'white',
		content: valuesLengthText,
		tags: true
	});



	screen.append(graph);
	screen.append(header);
	screen.append(lastTrace);

	cb(null, {
		screen: screen,
		graph: graph
	});
};

module.exports = function() {
	console.log('start');

	var interval;

	program
		.version('0.0.1')
		.option('-i, --interval <integer>')
		.option('-h, --host <host>')
		.option('-m, --max-y-value <integer>')
		.parse(process.argv);

	interval = program.interval || 1000;
	if(program.maxYValue) {
		maxYValue = program.maxYValue;
	}


	// initialize the blessed items and the drawille chart
	init(function(err, graphData) {

		var chart;

		graphDimensions.width = (graphData.graph.width - 2) * 2;
		graphDimensions.height = (graphData.graph.height - 2) * 4;

		graphData.screen.render();

		chart = new Canvas(graphDimensions.width, graphDimensions.height);


		setInterval(function() {
			//graph.setContent(drawChart());
			//updateTime();

			chart.clear();

			getPing(function(err, value) {
				//console.log(value);
				values.push(value);

				if(values.length>(graphData.graph.width - 2) * 2) {
					values.shift();
				}

				lastTrace.setContent(String(values.length));

				// loop through values to find the max value
				// used for auto-scaling the graph y axis
				highVal = 0;
				for(var v = 0; v < values.length; v++) {
					if(values[v] > highVal) {
						highVal = values[v];
					}
				}

				//console.log(value);

				process.nextTick(function() {
					drawChart(chart, values, function(err, frame) {
						graphData.graph.setContent(frame);
						graphData.screen.render();
					});
				});

			});
		}, interval);

	});
};