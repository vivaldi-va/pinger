/**
 * Created by vivaldi on 12/05/2015.
 */

var blessed = require('blessed');
var Canvas = require('drawille');
var program = require('commander');
var ping = require('net-ping');
var dns = require('dns');

var session = ping.createSession({timeout: 1000});

var host;
var ip;
var values = exports.values = [];
var highVal = 0;
var cachedAverage = 0;

var screen;
var graph;
var headerText;
var header;
var lastTrace;
var date;
var packetLoss;
var averagePing;
var updateLastTrace;
var zeroPad;
var updateTime;

var maxYValue;

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

var getPing = function(address, cb) {
	/*var lastValue = values[values.length - 1] || 0;
	 var value = Math.abs(Math.floor(lastValue + (boxMullerRandom() * 10)));
	 cb(null, value);*/


	session.pingHost(ip, function(err, target, sent, rcvd) {

		var ms;

		if(err) {

			if(err instanceof ping.RequestTimedOutError || err instanceof ping.DestinationUnreachableError) {
				ms = 0;
				return cb(null, ms);
			} else {
				return cb(err);
			}

		}

		ms = rcvd - sent;
		cb(null, ms);
	});

};

var computeY = function(height, input) {
	//var ceil =

	if(!highVal) {
		highVal = input;
	}

	var processedHighVal = highVal > maxYValue ? maxYValue : highVal;

	var y  = height - Math.floor(((height + 1) / 100) * ((input / maxYValue)*100)) + 1;
	//console.log('y: %d', y, "height: %d", height, "input %d", input, "high val %d", processedHighVal);
	return y;
	//return height - Math.floor(((height + 1)/100)*input);
};

exports.computeY = computeY;

var drawChart = function(chart, data, cb) {

	data.forEach(function(value, index) {
		var x = index + (graphDimensions.width - data.length);
		if(value > maxYValue) {
			value = maxYValue;
		}

		var y = computeY(graphDimensions.height, value);

		for(y; y < graphDimensions.height; y += 1) {
			if(maxYValue && value >= maxYValue && y === 0) {
				chart.set(x-1, y);
				chart.set(x+1, y);
			}
			chart.set(x, y);
		}
	});

	/*for(var pos = 0; pos < values.length; pos += 1) {
	 var x = pos + (graphDimensions.width - values.length);
	 var y = computeY(graphDimensions.height, values[pos]);

	 for(y; y < graphDimensions.height; y += 1) {
	 chart.set(x, y);
	 }
	 //console.log(x, y);

	 //console.log("chart: ", chart);

	 //process.exit(0);
	 }*/

	cb(null, chart.frame());

};

var calcJitter = function() {

	var sum;
	var diffs;

	if(values.length === 0) {
		return 0;
	}

	diffs = values.map(function (value, index) {
		if (index > 0) {
			return Math.abs(values[index - 1] - value)
		} else {
			return 0;
		}
	});

	sum = diffs.reduce(function (a, b) {
		return a + b;
	});

	if(sum === 0) {
		return 0;
	}


	return Math.round(sum / values.length);
};

var init = function (cb) {


	console.log('init');

	screen = blessed.screen({
		autoPadding: true,
		smartCSR: true
	});

	graph = blessed.box({
		top: 'top',
		left: 'left',
		width: '100%',
		height: '100%',
		content: '',
		tags: true,
		border: {
			type: 'line'
		},
		style: {
			fg: 'green',
			border: {
				fg: '#f0f0f0'
			},
		}
	});

	headerText = "Pinging " + host;
	header = blessed.text({
		top: 'top',
		left: 1,
		width: headerText.length,
		height: '1',
		fg: 'white',
		content: headerText,
		tags: true
	});

	date = blessed.text({
		top: 'top',
		right: 1,
		width: 9,
		height: '1',
		align: 'right',
		content: '',
		tags: true
	});

	lastTrace = blessed.text({
		top: 3,
		right: 1,
		width: 'width',
		height: '1',
		align: 'right',
		content: ''
	});


	packetLoss = function () {
		var loss = 0;
		var lostPackets = 0;
		values.forEach(function (value) {
			if (value === 0) {
				lostPackets += 1;
			}
		});

		if (lostPackets > 0 && values.length > 0) {
			loss = lostPackets / values.length;
		}

		return Math.floor(loss * 100);
	};

	averagePing = function () {
		var sum = 0;
		var count = 0;
		var average = 0;
		for (var pos = 0; pos < graphDimensions.width; pos += 1) {

			if (values[pos] > 0 && !!values[pos]) {
				sum += values[pos];
				count++;
			}
		}

		if (sum > 0 && count > 0) {
			average = Math.floor(sum / count);
		}

		cachedAverage = average;

		return average;
	};


	zeroPad = function (input) {
		return ('0' + input).slice(-2);
	};

	updateTime = function () {
		var time = new Date();
		date.setContent(zeroPad(time.getHours()) + ':' + zeroPad(time.getMinutes()) + ':' + zeroPad(time.getSeconds()) + ' ');
		//screen.render();
	};


	updateLastTrace = function () {
		var lastTraceString =
			"Last trace: " + values[values.length - 1] + "ms | " +
			"Average: " + averagePing() + "ms | " +
			"Highest Trace: " + highVal + "ms | " +
			"Jitter: " + calcJitter() + "% | " +
			"Packet loss: " + packetLoss() + "% | " +
			"Max Y: " + maxYValue + "ms";


		lastTrace.setContent(lastTraceString);
		lastTrace.width = lastTraceString.length;
		screen.render();
	};



	screen.append(graph);
	screen.append(date);
	screen.append(header);
	screen.append(lastTrace);

	cb(null, {
		screen: screen,
		graph: graph
	});
};

module.exports = function() {
	var interval;

	program
		.version('0.0.1')
		.option('-i, --interval <integer>')
		.option('-h, --host <host>')
		.option('-m, --max-y-value <integer>')
		.parse(process.argv);

	if(!program.host) {
		console.log('set a host with `-h <hostname>`');
		process.exit(0);
	}


	if(program.maxYValue) {
		maxYValue = program.maxYValue;
	}

	if(program.interval && program.interval < 1000) {
		console.log('Interval can not be less than 1000ms (1s)');
		process.exit(0);
	}

	interval = program.interval || 1000;
	host = program.host;


	dns.resolve4(program.host, function(err, addresses) {
		if(err) {
			console.error(err);
			process.exit(0);
		}


		ip = addresses[0];



		// initialize the blessed items and the drawille chart
		init(function(err, graphData) {

			var chart;

			graphDimensions.width = (graphData.graph.width - 2) * 2;
			graphDimensions.height = (graphData.graph.height - 2) * 4;

			graphData.screen.render();

			chart = new Canvas(graphDimensions.width, graphDimensions.height);


			setInterval(function() {
				//graph.setContent(drawChart());
				updateTime();

				chart.clear();

				if(!program.maxYValue) {
					maxYValue = cachedAverage * 5;
				}

				getPing(ip, function(err, value) {
					//console.log(value);
					values.push(value);

					if(values.length>(graphData.graph.width - 2) * 2) {
						values.shift();
					}

					lastTrace.setContent(String(values[values.length - 1]));

					// loop through values to find the max value
					// used for auto-scaling the graph y axis
					highVal = 0;
					for(var v = 0; v < values.length; v++) {
						if(values[v] > highVal) {
							highVal = values[v];
						}
					}

					process.nextTick(function() {
						drawChart(chart, values, function(err, frame) {
							graphData.graph.setContent(frame);
							graphData.screen.render();
							//console.log(addresses);
						});


						updateLastTrace();
					});

				});
			}, interval);

		});
	});
};