'use strict';

var cli = require('commander');
var blessed = require('blessed');
var Canvas = require('drawille');
var os = require('os');
var ping = require('net-ping');
var session = ping.createSession({timeout: 1000});
var program = blessed.program();
var dns = require('dns');

var host = process.argv[2];
var ip;
var values = [];
var highVal = 0;
var traces = 0;
var lostPackets = 0;


console.log("host: %s", host);

var screen = blessed.screen();

var graph = blessed.box({
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

var headerText = "Pinging " + host;
var header = blessed.text({
	top: 'top',
	left: 1,
	width: headerText.length,
	height: '1',
	fg: 'white',
	content: headerText,
	tags: true
});

var date = blessed.text({
	top: 'top',
	right: 1,
	width: 9,
	height: '1',
	align: 'right',
	content: '',
	tags: true
});

var lastTrace = blessed.text({
	top: 3,
	right: 1,
	width: 'width',
	height: '1',
	align: 'right',
	content: ''
});

var packetLoss = function() {
	var loss = 0;

	if(lostPackets > 0 && values.length > 0) {
		loss = lostPackets/values.length;
	}

	return Math.floor(loss * 100);
}

var averagePing = function() {
	var sum = 0;
	var count = 0;
	var average = 0;
	for(var val in values) {
		if(val >= graph.width) {
			break;
		}
		if(values[val] > 0 && !!values[val]) {
			sum += values[val];
			count++;
		}
	}

	if(sum > 0 && count > 0) {
		average = Math.floor(sum/count);
	}

	return average;
};


var zeroPad = function(input) {
	return ('0' + input).slice(-2);
};

var updateTime = function() {
	var time = new Date();
	date.setContent(zeroPad(time.getHours()) + ':' + zeroPad(time.getMinutes()) + ':' + zeroPad(time.getSeconds()) + ' ');
	//screen.render();
};


var updateLastTrace = function() {
	var lastTraceString = "Last trace: " + values[values.length - 1] + "ms | Average: " + averagePing() + "ms | Highest Trace: " + highVal + "ms | Packet loss: " + packetLoss() + "%";
	lastTrace.setContent(lastTraceString);
	lastTrace.width = lastTraceString.length;
	screen.render();
};


var getPing = function(cb) {
	session.pingHost(ip, function(err, target, sent, rcvd) {

		var ms;

		if(err) {

			if(err instanceof ping.RequestTimedOutError || err instanceof ping.DestinationUnreachableError) {
				ms = 0;
				lostPackets++;
				return cb(null, ms);
			} else {
				return cb(err);
			}

		}

		ms = rcvd - sent;
		cb(null, ms);
	});
};

var drawChart = function(cb) {
	var width = (graph.width - 2) * 2;
	var height = (graph.height - 2) * 4;
	var chart = new Canvas(width, height);

	var computeY = function(input, ceil) {
		return height - Math.floor(((height + 1) / 100) * ((input / highVal)*100)) + 1;
		//return height - Math.floor(((height + 1)/100)*input);
	};

	//console.log("Chart dimensions", chart);
	getPing(function(err, ms) {

		if(err) {
			console.error(err);
		}

		// shift values out of the array once they are out of the
		// scope of the graph to ensure performance
		if(values.length >= width) {
			values.shift();
		}

		values.push(ms);

		highVal = 0;
		for(var pos in values) {
			if(values[pos] > highVal) {
				highVal = values[pos];
			}
		}


		for(var pos in values) {


			var x = parseInt(pos) + (width-values.length);

			var y = computeY(values[pos]);

			for(y; y<height;y++) {
				chart.set(x, y);
			}

			//console.log("chart: ", chart);

			//process.exit(0);
			cb(null, chart.frame());
		}

	});


};

module.exports = function() {
	dns.resolve4(host, function(err, addresses) {
		if(err) {
			console.log(err);
		}

		ip = addresses[0];

		updateTime();

		screen.append(graph);
		screen.append(header);
		screen.append(date);
		screen.append(lastTrace);

		screen.render();
		setInterval(function() {
			//graph.setContent(drawChart());
			updateTime();
			drawChart(function(err, frame) {
				//console.log(frame);
				graph.setContent(frame);
				screen.render();
			});
			//screen.render();
			updateLastTrace();
		}, 1000);
	});
};




