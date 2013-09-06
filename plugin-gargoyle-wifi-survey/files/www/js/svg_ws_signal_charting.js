/*
	This program is copyright 2013 BashfulBladder, distributed under the GNU GPLv2.0
*/

var svgNS = "http://www.w3.org/2000/svg"
var y_unit;
var minx; //min x coordinate before entering label area of y axis
var maxx; //max x coordinate before falling off the visible chart
var twoPfour = 0;

function InitVars(yunit, mi_x, ma_x, tPf) {
	y_unit=yunit;
	minx=mi_x; maxx=ma_x;
	twoPfour = tPf;
}

//
//  InitChannelHighs initializes the all important ChSignalHigh array
//  ChSignalHigh allows matching a channel to a tier. Initially iter, channel & noise floor are stored.
//  As each station is plotted, the station with the highest signal is stored in the terminal member; -120 here
//  form is [ [1,36,-95,-120],[2,100,-93,-120],[3,157,-97,-120] ... ]
//  [ tier, channel number, noise floor in dbm, -120 in dbm (initial placeholder for record high)]
//    Note: this whole array is overkill for the 2.4GHz band, but in the interest of reducing redundancy....
//    Note2: ChSignalHigh is passed (by reference) because uglifyjs changes the name in the other .js files
//
function InitChannelHighs(tier, noise_floor_ltd, ChSignalHigh) {
	for (var i=0; i<noise_floor_ltd.length; i++) {
		ChSignalHigh.push([tier, noise_floor_ltd[i][0], noise_floor_ltd[i][2], -120]);
	}
}

//
//  GetChannelInfo returns channel info data given a single station's information Array
//    charray is a station's array for channel data - [11,"-"] in this station element example: ["DooDah", [11,"-"], 2462, -54]
//    supplemental_data is not used beyond being present or absent
//  Returns: the channel number (in the example below: 11) if supplemental_data is null
//  Returns: the extra data: "+"/"-"/"" for HT40 wide channel above/below if supplemental_data is present
//
function GetChannelInfo(charray, supplemental_data) {
	if (supplemental_data != null) {
		return charray[1];
	}
	return charray[0];
}

//
//  VerifyUniqColor tests whether html colors ('#45a43b') are sufficiently far apart
//    stations is the full array of stations - stations that have been plotted already & appended: ["DooDah", [11,"-"], 2462, -54, "#45a239"]
//    rColor,gColor,bColor are RGB color codes for the newly created color: integers 0-255
//  if the stations contains fewer than 50 members, the minimum difference is 31 (12%) or 12 (about 5%) for larger charts
//  only run tests on stations already plotted - they have a color code appended as the 5th element
//  the R-G-B colors from the hex html color code are parsed out into existingX variables
//  the existingX variables for each already plotted stations are tested against rColor,gColor,bColor to ensure the colors differ
//  Returns: 0 if colors are too similar; returns 1 if colors differ sufficiently
//
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

//
//  GenColor generates random html color codes
//    stations passes through & is not used in this function
//  rColor,gColor,bColor get random number assignments via inline colorcode()
//  if the R-G-B colors total > 256 (to avoid black stations on a nearly black chart), test uniqueness via VerifyUniqColor()
//  if VerifyUniqColor() results in the generated color not being sufficiently unique, generate a new color
//  Returns: a formatted hex color string "#45a239" via hexus() for each color
//
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

//
//  GetHeightFromSignal returns the y coordinate (height) of a signal
//    signal_level is the signal level (expressed as -56 in a chart chat ranges from 0 to -120)
//    Note: coordinates on a 2.4GHz chart are +10 - the 0,0 is translate(0,10)
//  Returns: the y coordinate of the signal height (each major y tick represents 900/130 pixels)
//  Returns: a y coordinate that may technically be outside of the tier - a tall stack of station names extending above 0 dbn
//
function GetHeightFromSignal(signal_level) {
	return ((signal_level > 0 ? (signal_level*y_unit)*-1 : Math.abs(signal_level)*y_unit) + (twoPfour==1?10:0))
}

//
//  GetChannelCenter returns the x coordinate of channel (the center)
//    channel is the channel to find
//  search the SVG DOM for the element (for example element 'Ch1', 'Ch165') created in InitTiers() with channelmarker.id
//  Returns: the x coordinate translated from the transform matrix -50 (chartarea has an x translate of 50)
//
function GetChannelCenter(channel) {
	var achannel=document.getElementById("Ch"+channel);
	if (achannel == null) { return null }
	var chann_tmatrix = achannel.getCTM();
	return chann_tmatrix.e/chann_tmatrix.d -50
}

//
// GetTierNoiseFloorCoord returns the y coordinate of the noise floor given a tier & x coordinate
//    tier is 1-3 (some may not be present, or null for a 2.4GHz chart)
//    x_point is the place where the noise floor path must intersect
//  get the SVG DOM element of the tier
//  working through each point of the noise floor path, test each x coordinate of the noise floor against x_point
//  Returns: the corresponding y coordinate of the noise floor (or the base of the chart if no point can be discerned
//
function GetNoiseFloorCoord(tier, x_point) {
	if (x_point < minx) { x_point = minx; }
	if (x_point > maxx) { x_point = maxx; }
	
	var nfpath = document.getElementById("NoiseFloorPath"+(tier == null ? "" : tier));
	if (nfpath == null) { return null }
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

//
//  GetStationYCoord returns the y coordinate of the station signal (that part above the noise floor) where it intersects with the noise floor
//    stationID is the SVG DOM path.id of the target station appeneded in plotStations()
//    x_point are (immaginary) points representing the beginning of the path (-99999) & the end (99999)
//  get the SVG DOM element of the path & its total length
//  Returns: the y coordinate of the starting point of the path or the terminal point - both intersect the noise floor
//
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

//
//  GetChannelRecordIndex returns the channel's position in the ChSignalHigh array (example: [1,36,-95,-120,""])
//  Returns: the index in the array
//
function GetChannelRecordIndex(channel, ChSignalHigh) {
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (channel==ChSignalHigh[i][1]) {
			return i
		}
	}
	return null
}

//
//  GetTierForChannel finds an arbitrary channel & tries to find the tier in which the channel is plotted
//  loop through the ChSignalHigh array (example: [1,36,-95,-120,""]), matching element 2
//  Returns: the tier in the matching ChSignalHigh member (element 1)
//
function GetTierForChannel(channel, ChSignalHigh) {
	for (var i=0; i<ChSignalHigh.length; i++) {
		if (channel==ChSignalHigh[i][1]) {
			return ChSignalHigh[i][0]
		}
	}
	return null
}

//
//  GeneratePolygonElement will create a polygon element with a limited set of attributes that needs appending
//    points is the list of points that form the vertices of the polygon; fill & opacity are apparent
//  Returns: a fully formed polygon element
//
function GeneratePolygonElement(points, fill, opacity) {
	var apoly=document.createElementNS(svgNS, "polygon");
	apoly.setAttributeNS(null, "points", points);
	apoly.setAttributeNS(null, 'fill', fill);
	apoly.setAttributeNS(null, 'opacity', opacity);
	return apoly;
}

//
//  GeneratePathElement will create a path element with a limited set of attributes that needs appending
//    pathdata is the generated mathematical path
//  Returns: a fully formed path element
//
function GeneratePathElement(swidth, pcolor, fcolor, fopacity, pathdata) {
	var apath = document.createElementNS(svgNS, "path");
	apath.setAttributeNS(null, 'stroke', pcolor);
	apath.setAttributeNS(null, 'stroke-width', swidth);
	apath.setAttributeNS(null, 'stroke-linejoin', "round");
	apath.setAttributeNS(null, 'd', pathdata);
	apath.setAttributeNS(null, 'fill', fcolor);
	apath.setAttributeNS(null, 'opacity', fopacity);
	return apath;
}

//
//  GenerateLineElement will create a line element with a limited set of attributes that needs appending
//    x2len, y2len are the terminal points of the line
//  Returns: a fully formed line element
//
function GenerateLineElement(x2len, y2len, stroke_width, stroke_color) {
	var aline = document.createElementNS(svgNS, "line");
	aline.setAttribute("x2", x2len);
	aline.setAttribute("y2", y2len);
	aline.setAttributeNS(null, 'stroke-width', stroke_width);
	aline.setAttributeNS(null, 'stroke', stroke_color);
	return aline;
}

//
//  GenerateTextElement will create a line element with a limited set of attributes that needs appending
//    xloc, yloc the point at which to place text
//  Returns: a fully formed text element
//
function GenerateTextElement(xloc, yloc, trans_vars, anchor, content, fsize, fstyle) {
	var tElement=document.createElementNS(svgNS, "text");
	tElement.setAttribute("x", xloc);
	tElement.setAttribute("y", yloc);
	tElement.setAttribute("transform", trans_vars);
	tElement.setAttribute("text-anchor", anchor);
	tElement.textContent = content;
	tElement.setAttribute("font-size", fsize);
	tElement.setAttribute("style", fstyle);
	return tElement;
}

//
//  PlotNoisePath will generate the bezier curve of the noisefloor path
//    inNoiseX is the inital starting x coordinate of the noisefllor; inNoiseY is the initial Y starting point
//  for each channel in ChSignalHigh, append a bezier curve of the noisefloor level stored in ChSignalHigh[ch][2]
//  using x coordinate of a channel center & the y coordinate of the signal height of the noise floor for this channel:
//    append the path with a bezier curve with control points part-way along from the last channel to the current channel:
//    1st control point is relative (x= 1/2 of the x difference, y=0 no vertical change)
//    2nd control point is relative (x= 1/2 of the x difference (relative to start point), y is full difference)
//      note: it helps to imagine a startpoint bottom, left - endpoint top, right. Draw an imaginary vertical line between the 2 points
//            1st control point is on the vertical line, at the same height as the startpoint;
//            2nd control point is on the vertical line, at the same height as the endpoint
//    terminal point of bezier curve is the x,y coordinate difference 
//    repeat bezier curve through all the channels
//  after the channels, draw a horizontal line out to absolute x=950 at the last y coordinate
//  Returns: the fully formed bezier waveform for the noisefloor
//
function PlotNoisePath(inNoiseX, inNoiseY, tier, ChSignalHigh) {
	var nline="M"+inNoiseX+","+inNoiseY;
	for (var ch=0; ch < ChSignalHigh.length; ch++) {
		if (tier == null && ChSignalHigh[ch][1] > 13) { continue }
		if (ChSignalHigh[ch][0] == tier) {
			var anoiseX = GetChannelCenter(ChSignalHigh[ch][1]);
			var anoiseY = GetHeightFromSignal(ChSignalHigh[ch][2]);
			nline+=" c"+(anoiseX-inNoiseX)/2+","+"0" /* x1,y1; x is 1/2 way to endpoint, no y-axis change */
				+","+(anoiseX-inNoiseX)/2+","+(anoiseY-inNoiseY) /* x2,y2 */
				+","+(anoiseX-inNoiseX)+","+(anoiseY-inNoiseY) /* endx,endy */
				+" ";
			inNoiseX=anoiseX;
			inNoiseY=anoiseY;
		}
	}
	nline+="L"+950+","+inNoiseY; //I think its better to hide the bottom flare than to be correct & end at the DFS
	return nline
}

//
//  PlotStationPath pots individual stations & enters them into the SVG DOM
//    stations is the full array of station data (on the station[idx] is used here, but is passed through to GenColor()
//    idx is the element index in the stations array to be plotted
//    chanWidth is the width of a 20MHz channel - channels may differ in x coordinate width based on how packed the tier is
//    tier is self-evident
//    container is the SVG DOM element that will have this path appended as a child (subject to its transform matrix in 5GHz)
//  find where the signal will cross the noise floor - each station path initially starts at the noise floor (subject to dipping under)
//    the points of station signal crossing the noisefloor are 19.5MHz apart - 120% of channel width; from channel center 60% of width
//  flatline the signal (partially or fully) if the signal is under the noisefloor (the noisefloor rose & the station disapeared)
//  if the channel is 40MHz wide, redo some of the variables because the sart/end points have moved along the x asix
//  the signal path begins as bezier curve up to the plateau of the signal using relative coordinates:
//    control pt1 is x=(1.65MHz of the channel width or 0.0825), y is 1/3 of the distance to the plateau
//    control pt2 is x=(1.65MHz of the channel width or 0.0825), y is 2/3 of the distance to the plateau
//    endpoint is x=(1.65MHz of the channel width or 0.0825), y is signal height of the channel
//   append the plateau, repeat with another bezier curve downward this time (flatline if needed by noise floor)
//  generate a color & append this as a stroke-only, fully opaque pathdata
//  continue generating path data for signal data *under* the noise floor down to -120, across the x axis & return to a (computed) start
//  append this color as a 70% transparent fill-only element
//  finally, append the generated color to each member of the stations array (used in the color for station SSID text label)
//
function PlotStationPath(stations, idx, chanWidth, tier, container) {
	var spath="";
	var signal_height = GetHeightFromSignal(stations[idx][3]);
	var channel_center = GetChannelCenter(GetChannelInfo(stations[idx][1]));
	var chanSpread = chanWidth * 0.8125; /* 16.25MHz utilized / 20MHz */
	var chanSpreadW = 0;
	var leadingNoise = GetNoiseFloorCoord(tier, channel_center-(chanSpread*0.6) );
	var trailingNoise = GetNoiseFloorCoord(tier, channel_center+(chanSpread*0.6) );
	var scolor=GenColor(stations);
	
	//flatline leading part of signal that is at or under the noisefloor; for stations that
	//have disappeared from the current survey, but are tracked for x minutes & the noise floor rose
	if (signal_height > leadingNoise) { leadingNoise = signal_height; }
	
	if (GetChannelInfo(stations[idx][1],1) == "+") {
		chanSpreadW = chanWidth * 1.6875;  /* 33.75MHz subcarrier / 20MHz */
		spath+="M"+(channel_center-(chanSpread*0.6)) +","+leadingNoise;
		trailingNoise = GetNoiseFloorCoord(tier, channel_center+(chanSpread*0.6)+(chanSpreadW-chanSpread));
	} else if (GetChannelInfo(stations[idx][1],1) == "-") {
		chanSpreadW = chanWidth * 1.6875;
		leadingNoise = GetNoiseFloorCoord(tier, channel_center-(chanSpread*0.6)-(chanSpreadW-chanSpread));
		if (signal_height > leadingNoise) { leadingNoise = signal_height; }
		spath+="M"+(channel_center-(chanSpread*0.6)-(chanSpreadW-chanSpread)) +","+leadingNoise;
	} else {
		chanSpreadW=0;
		spath+="M"+(channel_center-(chanSpread*0.6)) +","+leadingNoise;
	}
	
	//flatline trailing part of signal that is at or under the noisefloor; for stations that
	//have disappeared from the current survey, but are tracked for x minutes & the noise floor rose
	if (signal_height > trailingNoise) { trailingNoise = signal_height; }
	
	if (GetChannelInfo(stations[idx][1],1) == "b") { //802.11b has a different signal shape
		//more accurately, the signal is about 15% wider than calculated here, but as its less work...
		spath+= " c"+(chanSpread*0.05)+","+((signal_height-leadingNoise)*0.5) /* x1,y1 */
					+","+(chanSpread*0.05)+","+((signal_height-leadingNoise)*1.0) /* x2,y2 */
					+","+(chanSpread*0.6)+","+(signal_height-leadingNoise) /* endpoint */
		spath+= " c"+(chanSpread*0.55)+","+"0" /* x1,y1 */
					+","+(chanSpread*0.55)+","+Math.abs(signal_height-trailingNoise)*0.5 /* x2,y2 */
					+","+(chanSpread*0.6)+","+Math.abs(signal_height-trailingNoise) /* endpoint */
					+" ";
			
	} else { //802.11g & 802.11n
		spath+= " c"+(chanWidth*0.0825)+","+((signal_height-leadingNoise)*0.333) /* x1,y1 */
						+","+(chanWidth*0.0825)+","+((signal_height-leadingNoise)*0.666) /* x2,y2 */
						+","+(chanWidth*0.0825)+","+(signal_height-leadingNoise) /* endpoint */
						+" ";
			
		spath+="l"+(chanSpreadW==0 ? chanSpread : chanSpreadW)+","+"0";
		spath+= " c"+"0,"+Math.abs((signal_height-trailingNoise)*0.666) /* x1,y1 */
						+","+(chanWidth*0.0825)+","+Math.abs(signal_height-trailingNoise) /* x2,y2 */
						+","+(chanWidth*0.0825)+","+Math.abs(signal_height-trailingNoise) /* endpoint */
						+" ";
	}
	var stpath = GeneratePathElement(5, scolor, "transparent", 1.0, spath);
	stpath.id="StationPath_"+idx;
	container.appendChild(stpath);
	
	//for the fill ONLY, generate sweeping path data into the noise floor
	var chan_noisebase_y_delta=GetHeightFromSignal(-120)-GetStationYCoord(stpath.id, 99999);
	var chan_noisebase_x_spread = (chan_noisebase_y_delta/4) + chanWidth;
		
	spath+=" c"+"0"+","+(chan_noisebase_y_delta*0.333) /* x1,y1 */
				+","+(chan_noisebase_x_spread*0.165)+","+chan_noisebase_y_delta /* x2,y2 */
				+","+chan_noisebase_x_spread+","+chan_noisebase_y_delta /* endpoint */
				+" ";
	spath+="l"+chan_noisebase_x_spread * (chanSpreadW==0 ? -2.7825 : -3.335)+","+"0";
	
	var return_x=(chan_noisebase_x_spread*(chanSpreadW==0?2.75:3.335))
					-(chan_noisebase_x_spread+(chanSpreadW==0?chanSpread:chanSpreadW))-chanWidth*0.15;
	chan_noisebase_y_delta=GetHeightFromSignal(-120)-GetStationYCoord(stpath.id, -99999);
	spath+=" c"+return_x*0.33+",0" /* x1,y1 */
				+","+return_x+",-"+(chan_noisebase_y_delta*0.165) /* x2,y2 */
				+","+return_x+",-"+chan_noisebase_y_delta /* endpoint */
				+" ";
	var stpathFill = GeneratePathElement(0, scolor, scolor, 0.3, spath);
	container.appendChild(stpathFill);
		
	stations[idx].push(scolor);
}

//
//  GenerateLabels will drop a line from the highest signal down to -120 as a visual aid + label the stack with SSID station names
//    stations is the full stations array (example: [ [1,36,-95,-86] ... ]
//  1st loop drops lines in channels with a record signal > -120 (set in the last few lines of plotStations)
//  2nd loop labels the stations working backward (lowest signal to highest), but using the record high (plus some space) to stack
//
function GenerateLabels(stations, ChSignalHigh) {
	var container;
	for (var i = 0; i<ChSignalHigh.length; i++) {
		if (ChSignalHigh[i][3] > -120) {
			var chassL="M" + GetChannelCenter(ChSignalHigh[i][1])+","+GetHeightFromSignal(ChSignalHigh[i][3])
						+"l0,"+(GetHeightFromSignal(-120)-GetHeightFromSignal(ChSignalHigh[i][3]));
			var chassPE=GeneratePathElement(2, "#cccccc", "transparent", 0.6, chassL);
			if (twoPfour == 1) {
				container = document.getElementById("StationDataG");
			} else {
				container = document.getElementById("T"+ChSignalHigh[i][0]+"ChartG");
			}
			container.appendChild(chassPE);
		}
	}
	
	for (var j = stations.length-1; j> -1; j--) {
		var stchannel=GetChannelInfo(stations[j][1]);
		if (GetTierForChannel(stchannel, ChSignalHigh) == null && twoPfour != 1) { continue }
		if (stchannel > 13 && twoPfour == 1) { continue; } //stations contains 2.4GHz & 5GHz data
		if (stchannel < 30 && twoPfour != 1) { continue; } //stations contains 2.4GHz & 5GHz data
		var thisChannelInfo=ChSignalHigh[GetChannelRecordIndex(stchannel, ChSignalHigh)];
		thisChannelInfo[3]+=(twoPfour == 1?1.5:5);
		
		if (twoPfour == 1) {
			container = document.getElementById("StationDataG");
			var stextE=GenerateTextElement(GetChannelCenter(stchannel), GetHeightFromSignal(ChSignalHigh[stchannel-1][3]), null, "middle", stations[j][0], "30px", "fill:#000000;");
			stextE.setAttribute("filter","url(#blur1)");
			container.appendChild(stextE);
		
			var stextE2=GenerateTextElement(GetChannelCenter(stchannel), GetHeightFromSignal(ChSignalHigh[stchannel-1][3]), null, "middle", stations[j][0], "30px", "text-shadow: 2px 2px 5px #000000; fill:"+stations[j][4]);
			container.appendChild(stextE2);
		} else {
			var aTier = document.getElementById("T"+thisChannelInfo[0]+"ChartG");
			var textContainer = document.createElementNS(svgNS, "g");
			textContainer.setAttribute("transform", "translate("+ GetChannelCenter(stchannel) +","+ GetHeightFromSignal(thisChannelInfo[3])+")"); //this group element is subject to the transform of the parent tier; the text children will then be able to be in the correct location because of this elements translate, but the text element's transform matrix will unsquash the text
		
			var stextE = GenerateTextElement(0, 0, "matrix(1 0 0 3 0 0)", "middle", stations[j][0], "26px", "fill:#000000;");
			stextE.setAttribute("filter","url(#blur1)");
			var stextE2 = GenerateTextElement(0,0, "matrix(1 0 0 3 0 0)", "middle", stations[j][0], "26px", "text-shadow: 2px 2px 5px #000000; fill:"+stations[j][4]);
		
			textContainer.appendChild(stextE);
			textContainer.appendChild(stextE2);
			aTier.appendChild(textContainer);
		}
		thisChannelInfo[3]+=(twoPfour == 1?2.5:6);
		if(stations[j].length > 3) { stations[j].pop(); } //gets rid of the appended color code
	}
}
