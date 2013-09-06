/*
	This program is copyright 2013 BashfulBladder, distributed under the GNU GPLv2.0 
	See http://gargoyle-router.com/faq.html#qfoss for more information
*/

var svgNS = "http://www.w3.org/2000/svg"
var y_unit=7.625;
var ChSignalHigh = new Array();
	
	/*
	Note: in this chart (0,0) is in the top left corner; (1000,1000) is the bottom right corner
	*/

//
//  PlotNoiseFloor plots the noise floor
//    container is the parent container that gets deleted & reconstructed every 2 minutes
//    noise is the array from wifi_survey.js example: [ [1,2412,-90], [2,2417,-85] ... ]
//  pass the entry signal height of the noise floor from the first channel onto PlotNoisePath() which returns the waveform
//  generate a path element for the stroke (the line of the noise floor) fully opaque & append to the container
//  for the fill, continue plotting: V925 (vertical line down to 925), H0 (line back to 0)
//  append the path as the fill (it closes automatically with a fill) as 20% transparent
//
function PlotNoiseFloor(container, noise) {
	var nline=PlotNoisePath(0, GetHeightFromSignal(noise[0][2]), null, ChSignalHigh);
	
	var nfpath = GeneratePathElement(5, "#ffffff", "transparent", 1.0, nline);
	nfpath.id="NoiseFloorPath";
	container.appendChild(nfpath);
	var nffillpath = GeneratePathElement(0, "#ffffff", "#444444", 0.8, nline+ "V925 H0");
	nffillpath.id="NoiseFloorFill";
	container.appendChild(nffillpath);
}

//
//  plotStations will plot any existing stations (belonging to these frequencies) across available tiers
//    container is the parent container that gets deleted & reconstructed every 2 minutes
//    stations is the array of known stations (example: [ ["DooDah", [11,"-"], 2462, -54] ...]
//  find the width of a 20MHz channel - in the 2.4GHz band channels are 5MHz wide, so 4 total 20MHz
//  if the ChSignalHigh array contains a lower signal for this channel, change element 4 (-120 in this example: [1,36,-95,-120,""]) as the new record high for this channel
//
function PlotStations(container, stations) {
	var chanWidth = GetChannelCenter(8)-GetChannelCenter(4);
	
	for (var i = 0; i<stations.length; i++) {
		var stchannel=GetChannelInfo(stations[i][1]);
		if (stchannel > 13) { continue; } //stations contains 2.4GHz & 5GHz data
		
		PlotStationPath(stations, i, chanWidth, null, container);
				
		if (stations[i][3] > ChSignalHigh[stchannel-1][3]) {
			ChSignalHigh[(stchannel-1)][3] = parseInt(stations[i][3]);
		}
	}
}

//
//  plotBand starts the whole plotting process. First initialize band-dependent variables in signal charting.js
//  Eliminate ChSignalHigh old members to prepare new ones. Delete the SVG DOM elements that make the chart (ticks, paths, names)
//  And start plotting the noise, the stations, bring the noise forward & label the stations.
//
function plotBand(noise, stations) {
	InitVars(y_unit, 100, 855, 1);
	ChSignalHigh.length=0;
	InitChannelHighs(null, noise, ChSignalHigh);

	//deletes all channel data for nth run (all new colors, new noise floor & stations)
	var grouping = document.getElementById("StationDataG");
	if (grouping != null) {
		grouping.parentNode.removeChild(grouping);
	}

	var svgChart = document.getElementById("chartarea");
	var gStation = document.createElementNS (svgNS, "g");
	gStation.id="StationDataG";
	svgChart.appendChild(gStation);

	//noise floor first because y coordinates at the s bases of stations start at the noise floor
	PlotNoiseFloor(gStation, noise);
	PlotStations(gStation, stations);

	//bring noise floor to front of StationDataG to overlay the lower range of the signal(s)
	var npathE = document.getElementById("NoiseFloorPath");
	var nfillE = document.getElementById("NoiseFloorFill");
	gStation.removeChild(npathE);
	gStation.removeChild(nfillE);
	gStation.appendChild(npathE);
	gStation.appendChild(nfillE);

	GenerateLabels(stations, ChSignalHigh);
	gStation.appendChild(GeneratePolygonElement("-50,0 -5,0 -5,"+GetHeightFromSignal(noise[0][2])+" 0,"+GetHeightFromSignal(noise[0][2])+" 0,1000 -50,1000", "#222222", 0.8)); //creates a overlay polygon on signal data that may be in the y axis label area
}
