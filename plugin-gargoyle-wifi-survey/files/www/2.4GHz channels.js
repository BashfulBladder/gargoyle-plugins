/*
	This program is copyright 2013 BashfulBladder and is distributed under the terms of the GNU GPL 
	version 2.0 with a special clarification/exception that permits adapting the program to 
	configure proprietary "back end" software provided that all modifications to the web interface
	itself remain covered by the GPL. 
	See http://gargoyle-router.com/faq.html#qfoss for more information
*/

var svgNS = "http://www.w3.org/2000/svg"
var y_unit=7.625;
var ChSignalHigh = new Array();
	
	/*
	Note: in this chart (0,0) is in the top left corner; (1000,1000) is the bottom right corner
	*/
	
function GetChannelInfo(charray, supplemental_data) {
	if (supplemental_data != null) {
		return charray[1];
	}
	return charray[0];
}

function VerifyUniqColor(stations, rColor,gColor,bColor) {
	var uniqueness = stations.length < 50 ? 31 : 12;
	for (var i = 0; i<stations.length; i++) {
		if (stations[i].length == 5) {
			var existingR = parseInt(stations[i][4].substr(1,2),16);
			var existingG = parseInt(stations[i][4].substr(3,2),16);
			var existingB = parseInt(stations[i][4].substr(5,2),16);
			
			// if the values are within 5% of each other
			if (Math.abs(rColor-existingR) < uniqueness && Math.abs(gColor-existingG) < uniqueness && Math.abs(bColor-existingB) < uniqueness) {
				return 0
			}
		}
	}
	return 1
}

function GenColor(stations) {
	function colorcode() { return Math.floor(Math.random()*256); }
	function hexus(num) { return num < 16 ? "0" + num.toString(16) : num.toString(16) }
	var rColor=0;
	var gColor=0;
	var bColor=0;
	while (rColor+gColor+bColor < 256) {
		rColor=colorcode();
		gColor=colorcode();
		bColor=colorcode();
		
		if (VerifyUniqColor(stations, rColor,gColor,bColor) == 0) {
			rColor=0; gColor=0; bColor=0;
		}
	}
	return "#" + hexus(rColor) + hexus(gColor) + hexus(bColor);
}

function GetHeightFromSignal(signal_level) {
	return Math.abs(signal_level)*y_unit + 10
}

function GetChannelCenter(channel) {
	var achannel=document.getElementById("Ch"+channel);
	var chann_tmatrix = achannel.getCTM();
	return chann_tmatrix.e/chann_tmatrix.d -50
}

function GetNoiseFloorCoord(x_point) {
	if (x_point < 100) { x_point = 0; }
	if (x_point > 855) { x_point = 855; }
	
	var nfpath = document.getElementById("NoiseFloorPath");
	var nflength = nfpath.getTotalLength();
	var nfcoord=nfpath.getPointAtLength(0);
	for (var i=0; i<nflength; i++) {
		nfcoord=nfpath.getPointAtLength(i);
		if (Math.round(nfcoord.x) == Math.round(x_point)) {
			return nfcoord.y;
		}
	}
	return GetHeightFromSignal(-120);
}

//xpoint=-99999 will provide the initial y coordinate; xpoint=99999 will provide the terminal y coordinate
function GetStationYCoord(stationID, x_point) {
	var stapath = document.getElementById(stationID);
	var stalength = stapath.getTotalLength();
	var stacoord=stapath.getPointAtLength(0);
	if (x_point == 99999) {
		return stapath.getPointAtLength(stalength).y;
	}
	if (x_point == -99999) {
		return stapath.getPointAtLength(0).y;
	}
	for (var i=0; i<stalength; i++) {
		stacoord=stapath.getPointAtLength(i);
		if (Math.round(stacoord.x) == Math.round(x_point)) {
			return stacoord.y;
		}
	}
	return GetHeightFromSignal(-120);
}

function GeneratePathElement(swidth, pcolor, fcolor, fopacity, pathdata) {
	var apath = document.createElementNS (svgNS, "path");
	apath.setAttributeNS (null, 'stroke', pcolor);
	apath.setAttributeNS (null, 'stroke-width', swidth);
	apath.setAttributeNS (null, 'stroke-linejoin', "round");
	apath.setAttributeNS (null, 'd', pathdata);
	apath.setAttributeNS (null, 'fill', fcolor);
	apath.setAttributeNS (null, 'opacity', fopacity);
	return apath;
}

function GenerateTextElement(xloc, yloc, anchor, content, fsize, fstyle) {
	var tElement=document.createElementNS(svgNS, "text");
	tElement.setAttribute("x", xloc);
	tElement.setAttribute("y", yloc);
	tElement.setAttribute("text-anchor", anchor);
	tElement.textContent = content;
	tElement.setAttribute("font-size", fsize);
	tElement.setAttribute("style", fstyle);
	return tElement;
}

function plotNoiseFloor(container, noise) {
	var inNoiseX = 0;
	var inNoiseY = GetHeightFromSignal(noise[0][2]); //[1,2412,-90], [2,2417,-85]
	var nline="M"+inNoiseX+","+inNoiseY;
	
	for (var i=0; i<noise.length; i++) {
		if (noise[i][0] > 13) { continue; } //5GHz data
		var anoiseX = GetChannelCenter(noise[i][0]);
		var anoiseY = GetHeightFromSignal(noise[i][2]);
		nline+=" c"+(anoiseX-inNoiseX)/2+","+"0" /* x1,y1; x is 1/2 way to endpoint, no y-axis change */
					+","+(anoiseX-inNoiseX)/2+","+(anoiseY-inNoiseY) /* x2,y2 */
					+","+(anoiseX-inNoiseX)+","+(anoiseY-inNoiseY) /* endx,endy */
					+" ";
		inNoiseX=anoiseX;
		inNoiseY=anoiseY;
	}
	nline+="L"+950+","+inNoiseY;
	
	var nfpath = GeneratePathElement(5, "#ffffff", "transparent", 1.0, nline);
	nfpath.id="NoiseFloorPath";
	container.appendChild(nfpath);
	var nffillpath = GeneratePathElement(0, "#ffffff", "#444444", 0.8, nline+ "V925 H0");
	nffillpath.id="NoiseFloorFill";
	container.appendChild(nffillpath);
}

//plot each station from noise floor to plateau to noise floor with the curved slopes
//append each station's data with the generated color code - color is reused in BSSID label
//each station has 2 elements with the same path: the more vivid stroke & the more transparent fill
function plotStations(container, stations) { // [ ["Craptacity", 1, 2417, -65], ["YD5BA", 3, 2422, -87] ];
	var chanWidth = GetChannelCenter(6)-GetChannelCenter(5);
	var chanSpread = chanWidth * 3.25;
	var chanSpreadW = 0;
	
	for (var i = 0; i<stations.length; i++) {
		var stchannel=GetChannelInfo(stations[i][1]);
		if (stchannel > 13) { continue; } //stations contains 2.4GHz & 5GHz data
		
		var signal_height = GetHeightFromSignal(stations[i][3]);
		var channel_center = GetChannelCenter(stchannel);
		var leadingNoise = GetNoiseFloorCoord( channel_center-(chanSpread*0.6) );
		var trailingNoise = GetNoiseFloorCoord( channel_center+(chanSpread*0.6) );
		
		//flatline leading part of signal that is at or under the noisefloor; for stations that
		//have disappeared from the current survey, but are tracked for x minutes & the noise floor rose
		if (signal_height > leadingNoise) { leadingNoise = signal_height; }
					
		var spath="";
		if (GetChannelInfo(stations[i][1],1) == "+") {
			chanSpreadW = chanWidth * 6.75;
			spath+="M"+(channel_center-(chanSpread*0.6)) +","+leadingNoise;
			trailingNoise = GetNoiseFloorCoord(channel_center+(chanSpread*0.6)+(chanSpreadW-chanSpread));
		} else if (GetChannelInfo(stations[i][1],1) == "-") {
			chanSpreadW = chanWidth * 6.75;
			leadingNoise = GetNoiseFloorCoord(channel_center-(chanSpread*0.6)-(chanSpreadW-chanSpread));
			if (signal_height > leadingNoise) { leadingNoise = signal_height; }
			spath+="M"+(channel_center-(chanSpread*0.6)-(chanSpreadW-chanSpread)) +","+leadingNoise;
		} else {
			chanSpreadW=0;
			spath+="M"+(channel_center-(chanSpread*0.6)) +","+leadingNoise;
		}
		
		//flatline trailing part of signal that is at or under the noisefloor; for stations that
		//have disappeared from the current survey, but are tracked for x minutes & the noise floor rose
		if (signal_height > trailingNoise) { trailingNoise = signal_height; }
		
		if (GetChannelInfo(stations[i][1],1) == "b") { //802.11b has a different signal shape
			//more accurately, the signal is about 15% wider than calculated here, but as its less work...
			spath+= " c"+(chanSpread*0.05)+","+((signal_height-leadingNoise)*0.5) /* x1,y1 */
						+","+(chanSpread*0.05)+","+((signal_height-leadingNoise)*1.0) /* x2,y2 */
						+","+(chanSpread*0.6)+","+(signal_height-leadingNoise) /* endpoint */
			spath+= " c"+(chanSpread*0.55)+","+"0" /* x1,y1 */
						+","+(chanSpread*0.55)+","+Math.abs(signal_height-trailingNoise)*0.5 /* x2,y2 */
						+","+(chanSpread*0.6)+","+Math.abs(signal_height-trailingNoise) /* endpoint */
						+" ";
			
		} else { //802.11g & 802.11n
			spath+= " c"+(chanWidth*0.33)+","+((signal_height-leadingNoise)*0.333) /* x1,y1 */
						+","+(chanWidth*0.33)+","+((signal_height-leadingNoise)*0.666) /* x2,y2 */
						+","+(chanWidth*0.33)+","+(signal_height-leadingNoise) /* endpoint */
						+" ";
			
			spath+="l"+(chanSpreadW==0 ? chanSpread : chanSpreadW)+","+"0";
			spath+= " c"+"0,"+Math.abs((signal_height-trailingNoise)*0.666) /* x1,y1 */
						+","+(chanWidth*0.33)+","+Math.abs(signal_height-trailingNoise) /* x2,y2 */
						+","+(chanWidth*0.33)+","+Math.abs(signal_height-trailingNoise) /* endpoint */
						+" ";
		}
		var scolor=GenColor(stations);
		
		var stpath = GeneratePathElement(5, scolor, "transparent", 1.0, spath);
		stpath.id="StationPath_"+i;
		container.appendChild(stpath);
		
		//for the fill ONLY, generate sweeping path data into the noise floor
		var chan_noisebase_y_delta=GetHeightFromSignal(-120)-GetStationYCoord(stpath.id, 99999);
		var chan_noisebase_x_spread = chan_noisebase_y_delta + chanWidth;
		
		spath+=" c"+"0"+","+(chan_noisebase_y_delta*0.333) /* x1,y1 */
					+","+(chan_noisebase_x_spread*0.66)+","+chan_noisebase_y_delta /* x2,y2 */
					+","+chan_noisebase_x_spread+","+chan_noisebase_y_delta /* endpoint */
					+" ";
		//spath+="l"+chan_noisebase_x_spread*-2.7825+","+"0";
		spath+="l"+chan_noisebase_x_spread * (chanSpreadW==0 ? -2.7825 : -3.535)+","+"0";
		
		var return_x=(chan_noisebase_x_spread*2.75)-(chan_noisebase_x_spread+chanWidth * 3.125)-chanWidth*0.6;
		chan_noisebase_y_delta=GetHeightFromSignal(-120)-GetStationYCoord(stpath.id, -99999);
		spath+=" c"+(return_x*0.33)+",0" /* x1,y1 */
					+","+return_x+",-"+(chan_noisebase_y_delta*0.666) /* x2,y2 */
					+","+return_x+",-"+chan_noisebase_y_delta /* endpoint */
					+" ";
		
		var stpathFill = GeneratePathElement(0, scolor, scolor, 0.3, spath);
		container.appendChild(stpathFill);
		
		stations[i].push(scolor);
		if (ChSignalHigh[ stchannel-1 ] > signal_height) {
			ChSignalHigh[ stchannel-1 ] = signal_height;
		}
	}
}

//1st for loop drops lines from highest signal in each channel (above background noise) as an indicator of channel assignment
//2nd for loop adds station BSSIDs text labels from lowest signal level to highest (already sorted by wifi_survey.js)
function GenerateLabels(container, stations) {
	for (var i = 0; i<ChSignalHigh.length; i++) {
		if (ChSignalHigh[i] > -120) {
			var chassL="M" + GetChannelCenter(i+1)+","+ChSignalHigh[i]
						+"l0,"+(GetHeightFromSignal(-120)-ChSignalHigh[i]);
			var chassPE=GeneratePathElement(2, "#cccccc", "transparent", 0.6, chassL);
			container.appendChild(chassPE);
		}
	}
	
	for (var j = stations.length-1; j> -1; j--) {
		var stchannel=GetChannelInfo(stations[j][1]);
		if (stchannel > 13) { continue; } //stations contains 2.4GHz & 5GHz data
		ChSignalHigh[stchannel-1]-=(1.5*y_unit);
		
		var stextE=GenerateTextElement(GetChannelCenter(stchannel), ChSignalHigh[stchannel-1], "middle", stations[j][0], "30px", "fill:#000000;");
		stextE.setAttribute("filter","url(#blur1)");
		container.appendChild(stextE);
		
		var stextE2=GenerateTextElement(GetChannelCenter(stchannel), ChSignalHigh[stchannel-1], "middle", stations[j][0], "30px", "text-shadow: 2px 2px 5px #000000; fill:"+stations[j][4]);
		container.appendChild(stextE2);
		
		ChSignalHigh[stchannel-1]-=(3*y_unit);
		stations[j].pop();
	}
}

//creates a overlay polygon on signal data that may be in the y axis label area
function GenYBacker(container, initial_noise) {
	var apoly=document.createElementNS(svgNS, "polygon");
	apoly.setAttributeNS(null, "points", "-50,0 -5,0 -5,"+initial_noise+" 0,"+initial_noise+" 0,1000 -50,1000");
	apoly.setAttributeNS(null, 'fill', "#222222");
	apoly.setAttributeNS(null, 'opacity', 0.8);
	container.appendChild(apoly);
}

//ChSignalHigh stores the highest signal in a channel (500px is higher than 900px in this chart) while channels are plotted
//during GenerateLabels(), ChSignalHigh takes on the role of where to put text labels on the y axis in a given channel
function InitChannelHighs() {
	for (var i=0; i<13; i++) {
		ChSignalHigh[i] = GetHeightFromSignal( -120 );
	}
}

function plotBand(noise, stations) {
	InitChannelHighs();

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
	plotNoiseFloor(gStation, noise);
	plotStations(gStation, stations);

	//bring noise floor to front of StationDataG to overlay the lower range of the signal(s)
	var npathE = document.getElementById("NoiseFloorPath");
	var nfillE = document.getElementById("NoiseFloorFill");
	gStation.removeChild(npathE);
	gStation.removeChild(nfillE);
	gStation.appendChild(npathE);
	gStation.appendChild(nfillE);

	GenerateLabels(gStation, stations);
	GenYBacker(gStation, GetHeightFromSignal(noise[0][2]));
}
